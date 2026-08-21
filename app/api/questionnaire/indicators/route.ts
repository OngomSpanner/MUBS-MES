import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import { ensureQuestionnaireObjectiveSchema, ensureQuestionnaireSubMetricsSchema, SQL_RESOLVED_INDICATOR_PILLAR, SQL_RESOLVED_INDICATOR_PILLAR_CODE } from '@/lib/questionnaire-schema';
import { parseStrategicPillar, strategicPillarCode } from '@/lib/strategic-plan';
import { fetchDepartmentsWithAmbassador } from '@/lib/departments-with-ambassador';
import {
  AMBASSADOR_GROUP_ORDER,
  type AmbassadorDepartmentGroup,
} from '@/lib/department-ambassador-groups';
import {
  refreshIndicatorAssignedGroupFlags,
  syncIndicatorDepartmentGroups,
} from '@/lib/questionnaire/sync-indicator-groups';
import {
  ensureIndicatorTargetsSchema,
  loadIndicatorTargets,
  saveIndicatorTargets,
  type IndicatorTargetInput,
} from '@/lib/questionnaire-metric-targets';
import { saveIndicatorMetrics } from '@/lib/questionnaire/save-indicator-metrics';
import { withInheritedUnits } from '@/lib/questionnaire/metric-tree';

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
    await ensureQuestionnaireSubMetricsSchema();
    await ensureIndicatorTargetsSchema();
    const catalog = await fetchDepartmentsWithAmbassador(true);
    const indicatorRows = await query({
      query: `SELECT i.id, i.outcome_id, i.indicator_text, i.is_locked, i.created_at,
                i.strategic_pillar AS indicator_strategic_pillar,
                i.pillar_code AS indicator_pillar_code,
                o.type AS outcome_type, o.label AS outcome_label,
                o.strategic_objective AS outcome_strategic_objective,
                ${SQL_RESOLVED_INDICATOR_PILLAR} AS outcome_strategic_pillar,
                ${SQL_RESOLVED_INDICATOR_PILLAR_CODE} AS outcome_pillar_code
              FROM q_indicators i
              JOIN q_outcomes o ON o.id = i.outcome_id
              ORDER BY outcome_strategic_pillar, o.strategic_objective, o.type, o.label, i.indicator_text`,
    }) as any[];

    for (const ind of indicatorRows) {
      await syncIndicatorDepartmentGroups(Number(ind.id), catalog);
    }

    const indicators = indicatorRows;

    const metrics = await query({
      query: `
        SELECT id, indicator_id, metric_text, unit_of_measure, parent_metric_id, aggregation, is_total, sort_order
        FROM q_metrics
        ORDER BY indicator_id, sort_order
      `,
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
      const rawMetrics = (metricsMap.get(id) ?? []).map((m) => ({
        ...m,
        id: Number(m.id),
        metric_text: String(m.metric_text ?? ''),
        unit_of_measure: String(m.unit_of_measure ?? 'numeric'),
        parent_metric_id: m.parent_metric_id != null ? Number(m.parent_metric_id) : null,
        aggregation: m.aggregation ?? null,
        is_total: m.is_total ?? 0,
        sort_order: Number(m.sort_order ?? 0),
      }));
      return {
        ...ind,
        id,
        is_locked: Boolean(ind.is_locked),
        metrics: withInheritedUnits(rawMetrics),
        targets: targetsByIndicator.get(id) ?? [],
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
    const financialYears: string[] = Array.isArray(body.financial_years)
      ? [...new Set(
          (body.financial_years as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map((s) => normalizeFinancialYear(s)),
        )]
      : [];
    const metrics: {
      id?: number;
      client_id?: string;
      parent_metric_id?: number | null;
      parent_client_id?: string | null;
      metric_text: string;
      unit_of_measure: string;
      aggregation?: string | null;
      is_total?: boolean | number;
    }[] = Array.isArray(body.metrics) ? body.metrics : [];
    const indicatorTargets: IndicatorTargetInput[] = Array.isArray(body.targets) ? body.targets : [];
    const strategicPillar = parseStrategicPillar(body.strategic_pillar);
    const pillarCode = strategicPillarCode(strategicPillar);

    if (!outcomeId) return NextResponse.json({ message: 'outcome_id is required' }, { status: 400 });
    if (!indicatorText) return NextResponse.json({ message: 'indicator_text is required' }, { status: 400 });
    if (departmentIds.length === 0) return NextResponse.json({ message: 'At least one department is required' }, { status: 400 });
    if (financialYears.length === 0) return NextResponse.json({ message: 'At least one reporting period is required' }, { status: 400 });
    const validMetrics = metrics.filter((m) => typeof m.metric_text === 'string' && m.metric_text.trim());
    if (validMetrics.length === 0) return NextResponse.json({ message: 'At least one metric is required' }, { status: 400 });

    const result = await query({
      query: 'INSERT INTO q_indicators (outcome_id, indicator_text, strategic_pillar, pillar_code) VALUES (?, ?, ?, ?)',
      values: [outcomeId, indicatorText, strategicPillar, pillarCode],
    }) as any;
    const indicatorId = result.insertId;

    for (const deptId of departmentIds) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [indicatorId, deptId] });
    }
    for (const fy of financialYears) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [indicatorId, fy] });
    }
    await ensureIndicatorTargetsSchema();
    await saveIndicatorMetrics(indicatorId, validMetrics);
    if (indicatorTargets.length > 0) {
      await saveIndicatorTargets(indicatorId, financialYears, indicatorTargets);
    }

    const catalog = await fetchDepartmentsWithAmbassador(true);
    const assignedGroupsRaw: unknown[] = Array.isArray(body.assigned_groups) ? body.assigned_groups : [];
    const assignedGroups = assignedGroupsRaw
      .map((g) => String(g))
      .filter((g): g is AmbassadorDepartmentGroup =>
        (AMBASSADOR_GROUP_ORDER as readonly string[]).includes(g),
      );
    await refreshIndicatorAssignedGroupFlags(
      indicatorId,
      departmentIds,
      catalog,
      Array.isArray(body.assigned_groups) ? assignedGroups : null,
    );
    await syncIndicatorDepartmentGroups(indicatorId, catalog);

    return NextResponse.json({ id: indicatorId }, { status: 201 });
  } catch (e) {
    console.error('q_indicators POST', e);
    return NextResponse.json({ message: 'Error creating indicator' }, { status: 500 });
  }
}
