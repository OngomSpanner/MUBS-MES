import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import { ensureQuestionnaireObjectiveSchema } from '@/lib/questionnaire-schema';
import { fetchDepartmentsWithAmbassador } from '@/lib/departments-with-ambassador';
import {
  refreshIndicatorAssignedGroupFlags,
  syncIndicatorDepartmentGroups,
} from '@/lib/questionnaire/sync-indicator-groups';
import {
  attachTargetsToMetrics,
  ensureMetricTargetsSchema,
  loadIndicatorTargets,
  saveIndicatorTargets,
  type MetricTargetInput,
} from '@/lib/questionnaire-metric-targets';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureQuestionnaireObjectiveSchema();
    await ensureMetricTargetsSchema();
    const catalog = await fetchDepartmentsWithAmbassador(true);
    const indicatorRows = await query({
      query: `SELECT i.id, i.outcome_id, i.indicator_text, i.is_locked, i.created_at,
                o.type AS outcome_type, o.label AS outcome_label,
                o.strategic_objective AS outcome_strategic_objective
              FROM q_indicators i
              JOIN q_outcomes o ON o.id = i.outcome_id
              ORDER BY o.strategic_objective, o.type, o.label, i.indicator_text`,
    }) as any[];

    for (const ind of indicatorRows) {
      await syncIndicatorDepartmentGroups(Number(ind.id), catalog);
    }

    const indicators = indicatorRows;

    const metrics = await query({
      query: 'SELECT id, indicator_id, metric_text, unit_of_measure, sort_order FROM q_metrics ORDER BY indicator_id, sort_order',
    }) as any[];

    const depts = await query({
      query: `SELECT qid.indicator_id, d.id AS department_id, COALESCE(NULLIF(TRIM(d.external_name),''), d.name) AS department_name
              FROM q_indicator_departments qid
              JOIN departments d ON d.id = qid.department_id`,
    }) as any[];

    const fys = await query({
      query: 'SELECT indicator_id, financial_year FROM q_indicator_fys ORDER BY indicator_id, financial_year',
    }) as any[];

    const metricsMap = new Map<number, any[]>();
    for (const m of metrics) {
      const indicatorId = Number(m.indicator_id);
      if (!metricsMap.has(indicatorId)) metricsMap.set(indicatorId, []);
      metricsMap.get(indicatorId)!.push(m);
    }

    const deptsMap = new Map<number, any[]>();
    for (const d of depts) {
      const indicatorId = Number(d.indicator_id);
      if (!deptsMap.has(indicatorId)) deptsMap.set(indicatorId, []);
      deptsMap.get(indicatorId)!.push({ id: Number(d.department_id), name: d.department_name });
    }

    const fysMap = new Map<number, string[]>();
    for (const f of fys) {
      const indicatorId = Number(f.indicator_id);
      if (!fysMap.has(indicatorId)) fysMap.set(indicatorId, []);
      fysMap.get(indicatorId)!.push(normalizeFinancialYear(f.financial_year));
    }

    const targetsByIndicator = new Map<number, Awaited<ReturnType<typeof loadIndicatorTargets>>>();
    for (const ind of indicatorRows) {
      targetsByIndicator.set(Number(ind.id), await loadIndicatorTargets(Number(ind.id)));
    }

    const result = indicators.map((ind) => {
      const id = Number(ind.id);
      const rawMetrics = (metricsMap.get(id) ?? []).map((m: { id: number }) => ({ ...m, id: Number(m.id) }));
      return {
        ...ind,
        id,
        is_locked: Boolean(ind.is_locked),
        metrics: attachTargetsToMetrics(rawMetrics, targetsByIndicator.get(id) ?? []),
        departments: deptsMap.get(id) ?? [],
        financial_years: fysMap.get(id) ?? [],
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error('q_indicators GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const outcomeId = Number(body.outcome_id);
    const indicatorText = typeof body.indicator_text === 'string' ? body.indicator_text.trim() : '';
    const departmentIds: number[] = Array.isArray(body.department_ids) ? body.department_ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [];
    const financialYears: string[] = Array.isArray(body.financial_years) ? body.financial_years.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : [];
    const metrics: {
      metric_text: string;
      unit_of_measure: string;
      targets?: { financial_year: string; target_value?: string | null }[];
    }[] = Array.isArray(body.metrics) ? body.metrics : [];

    if (!outcomeId) return NextResponse.json({ message: 'outcome_id is required' }, { status: 400 });
    if (!indicatorText) return NextResponse.json({ message: 'indicator_text is required' }, { status: 400 });
    if (departmentIds.length === 0) return NextResponse.json({ message: 'At least one department is required' }, { status: 400 });
    if (financialYears.length === 0) return NextResponse.json({ message: 'At least one financial year is required' }, { status: 400 });
    const validMetrics = metrics.filter((m) => typeof m.metric_text === 'string' && m.metric_text.trim());
    if (validMetrics.length === 0) return NextResponse.json({ message: 'At least one metric is required' }, { status: 400 });

    const result = await query({
      query: 'INSERT INTO q_indicators (outcome_id, indicator_text) VALUES (?, ?)',
      values: [outcomeId, indicatorText],
    }) as any;
    const indicatorId = result.insertId;

    for (const deptId of departmentIds) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [indicatorId, deptId] });
    }
    for (const fy of financialYears) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [indicatorId, fy] });
    }
    await ensureMetricTargetsSchema();
    const targetEntries: MetricTargetInput[] = [];
    for (let i = 0; i < validMetrics.length; i++) {
      const uom = validMetrics[i].unit_of_measure || 'numeric';
      const insertResult = await query({
        query: 'INSERT INTO q_metrics (indicator_id, metric_text, unit_of_measure, sort_order) VALUES (?, ?, ?, ?)',
        values: [indicatorId, validMetrics[i].metric_text.trim(), uom, i],
      }) as { insertId: number };
      const metricId = insertResult.insertId;
      for (const t of validMetrics[i].targets ?? []) {
        targetEntries.push({
          metric_id: metricId,
          financial_year: t.financial_year,
          target_value: t.target_value,
        });
      }
    }
    if (targetEntries.length > 0) {
      await saveIndicatorTargets(indicatorId, financialYears, targetEntries);
    }

    const catalog = await fetchDepartmentsWithAmbassador(true);
    await refreshIndicatorAssignedGroupFlags(indicatorId, departmentIds, catalog);
    await syncIndicatorDepartmentGroups(indicatorId, catalog);

    return NextResponse.json({ id: indicatorId }, { status: 201 });
  } catch (e) {
    console.error('q_indicators POST', e);
    return NextResponse.json({ message: 'Error creating indicator' }, { status: 500 });
  }
}
