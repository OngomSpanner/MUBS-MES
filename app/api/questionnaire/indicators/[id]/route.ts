import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import { ensureQuestionnaireObjectiveSchema, ensureQuestionnaireSubMetricsSchema } from '@/lib/questionnaire-schema';
import { fetchDepartmentsWithAmbassador } from '@/lib/departments-with-ambassador';
import {
  getIndicatorAssignedGroups,
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

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const indicatorId = Number(id);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) {
      return NextResponse.json({ message: 'Invalid indicator id' }, { status: 400 });
    }

    await ensureQuestionnaireObjectiveSchema();
    await ensureQuestionnaireSubMetricsSchema();
    await ensureIndicatorTargetsSchema();
    const catalog = await fetchDepartmentsWithAmbassador(true);
    await syncIndicatorDepartmentGroups(indicatorId, catalog);

    const rows = await query({
      query: `SELECT i.id, i.outcome_id, i.indicator_text, i.is_locked, i.created_at,
                o.type AS outcome_type, o.label AS outcome_label,
                o.strategic_objective AS outcome_strategic_objective
              FROM q_indicators i
              JOIN q_outcomes o ON o.id = i.outcome_id
              WHERE i.id = ?`,
      values: [indicatorId],
    }) as any[];

    if (!rows.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    const ind = rows[0];

    const metrics = await query({
      query: `
        SELECT id, metric_text, unit_of_measure, parent_metric_id, aggregation, is_total, sort_order
        FROM q_metrics
        WHERE indicator_id = ?
        ORDER BY sort_order
      `,
      values: [indicatorId],
    }) as any[];

    const departments = await query({
      query: `SELECT d.id, COALESCE(NULLIF(TRIM(d.external_name),''), d.name) AS name
              FROM q_indicator_departments qid
              JOIN departments d ON d.id = qid.department_id
              WHERE qid.indicator_id = ?
              ORDER BY name`,
      values: [indicatorId],
    }) as { id: number; name: string }[];

    const financialYears = await query({
      query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ? ORDER BY financial_year',
      values: [indicatorId],
    }) as { financial_year: string }[];

    const assignedGroups = await getIndicatorAssignedGroups(indicatorId);
    const targets = await loadIndicatorTargets(indicatorId);

    return NextResponse.json({
      ...ind,
      id: indicatorId,
      is_locked: Boolean(ind.is_locked),
      metrics: metrics.map((m) => ({ ...m, id: Number(m.id) })),
      targets,
      departments: departments.map((d) => ({ id: Number(d.id), name: d.name })),
      financial_years: financialYears.map((f) => normalizeFinancialYear(f.financial_year)),
      assigned_groups: assignedGroups,
    });
  } catch (e) {
    console.error('q_indicators GET [id]', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json();
    const overrideRemoveDepartments = body.override_remove_departments === true || body.override_remove_departments === 1;

    const indicatorText = typeof body.indicator_text === 'string' ? body.indicator_text.trim() : '';
    const outcomeId = Number(body.outcome_id);
    const departmentIds: number[] = Array.isArray(body.department_ids) ? body.department_ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [];
    const financialYears: string[] = Array.isArray(body.financial_years) ? body.financial_years.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : [];
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

    if (!indicatorText) return NextResponse.json({ message: 'indicator_text is required' }, { status: 400 });
    if (!outcomeId) return NextResponse.json({ message: 'outcome_id is required' }, { status: 400 });
    if (departmentIds.length === 0) return NextResponse.json({ message: 'At least one department is required' }, { status: 400 });
    if (financialYears.length === 0) return NextResponse.json({ message: 'At least one financial year is required' }, { status: 400 });
    const validMetrics = metrics.filter((m) => typeof m.metric_text === 'string' && m.metric_text.trim());
    if (validMetrics.length === 0) return NextResponse.json({ message: 'At least one metric is required' }, { status: 400 });

    await ensureIndicatorTargetsSchema();

    await query({ query: 'UPDATE q_indicators SET outcome_id=?, indicator_text=? WHERE id=?', values: [outcomeId, indicatorText, id] });

    // Replace departments and FYs (does not affect existing responses)
    const existingDeptRows = (await query({
      query: 'SELECT department_id FROM q_indicator_departments WHERE indicator_id=?',
      values: [id],
    })) as { department_id: number }[];
    const existingDeptIds = existingDeptRows.map((r) => Number(r.department_id)).filter((n) => Number.isFinite(n) && n > 0);
    const existingSet = new Set(existingDeptIds);
    const incomingSet = new Set(departmentIds);
    const removedDeptIds = existingDeptIds.filter((d) => existingSet.has(d) && !incomingSet.has(d));

    if (removedDeptIds.length > 0 && !overrideRemoveDepartments) {
      const removedPlaceholders = removedDeptIds.map(() => '?').join(',');
      const rows = (await query({
        query: `
          SELECT r.department_id, COUNT(*) AS cnt,
                 COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
          FROM q_responses r
          JOIN departments d ON d.id = r.department_id
          WHERE r.indicator_id = ?
            AND r.department_id IN (${removedPlaceholders})
            AND r.value IS NOT NULL AND TRIM(r.value) <> ''
          GROUP BY r.department_id, department_name
        `,
        values: [id, ...removedDeptIds],
      })) as { department_id: number; cnt: number; department_name: string }[];

      const blocking = rows.filter((r) => Number(r.cnt) > 0);
      if (blocking.length > 0) {
        return NextResponse.json({
          message: 'Some removed offices already submitted data for this indicator.',
          requires_confirmation: true,
          removed_offices_with_data: blocking.map((r) => ({
            department_id: Number(r.department_id),
            department_name: String(r.department_name || '').trim(),
            response_count: Number(r.cnt),
          })),
        }, { status: 409 });
      }
    }

    await query({ query: 'DELETE FROM q_indicator_departments WHERE indicator_id=?', values: [id] });
    for (const deptId of departmentIds) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [id, deptId] });
    }
    await query({ query: 'DELETE FROM q_indicator_fys WHERE indicator_id=?', values: [id] });
    for (const fy of financialYears) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [id, fy] });
    }

    // Update metrics: keep existing by id, add new, delete removed
    await saveIndicatorMetrics(Number(id), validMetrics);

    await saveIndicatorTargets(Number(id), financialYears, indicatorTargets);

    const catalog = await fetchDepartmentsWithAmbassador(true);
    await refreshIndicatorAssignedGroupFlags(Number(id), departmentIds, catalog);
    await syncIndicatorDepartmentGroups(Number(id), catalog);

    return NextResponse.json({ message: 'Updated' });
  } catch (e) {
    console.error('q_indicators PUT', e);
    return NextResponse.json({ message: 'Error updating indicator' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const respCount = await query({ query: 'SELECT COUNT(*) as cnt FROM q_responses WHERE indicator_id=?', values: [id] }) as any[];
    const count = respCount[0].cnt as number;
    // Confirm token required when data exists
    const url = new URL(request.url);
    const confirmed = url.searchParams.get('confirmed') === '1';
    if (count > 0 && !confirmed) {
      return NextResponse.json({ message: 'Has responses', response_count: count, requires_confirmation: true }, { status: 409 });
    }
    // Delete responses first, then metrics, then junctions, then indicator
    await query({ query: 'DELETE FROM q_responses WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicator_fy_targets WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_metrics WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicator_departments WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicator_fys WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicators WHERE id=?', values: [id] });
    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    console.error('q_indicators DELETE', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
