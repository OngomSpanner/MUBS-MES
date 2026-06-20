import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

/** GET ambassador-collected questionnaire data, optionally filtered by department. */
export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await ensureHodReviewWorkflowSchema();

    const { searchParams } = new URL(request.url);
    const departmentIdParam = searchParams.get('department_id');
    const departmentId =
      departmentIdParam && departmentIdParam !== 'all' ? Number(departmentIdParam) : null;
    if (departmentIdParam && departmentIdParam !== 'all' && !Number.isFinite(departmentId)) {
      return NextResponse.json({ message: 'Invalid department_id' }, { status: 400 });
    }

    const indicators = (await query({
      query: `SELECT i.id, i.outcome_id, i.indicator_text, i.is_locked,
                o.type AS outcome_type, o.label AS outcome_label
              FROM q_indicators i
              JOIN q_outcomes o ON o.id = i.outcome_id
              ORDER BY o.type, o.label, i.indicator_text`,
    })) as {
      id: number;
      outcome_id: number;
      indicator_text: string;
      is_locked: number;
      outcome_type: string;
      outcome_label: string;
    }[];

    const metrics = (await query({
      query:
        'SELECT id, indicator_id, metric_text, unit_of_measure, sort_order FROM q_metrics ORDER BY indicator_id, sort_order',
    })) as { id: number; indicator_id: number; metric_text: string; unit_of_measure: string; sort_order: number }[];

    const deptRows = (await query({
      query: `SELECT qid.indicator_id, d.id AS department_id,
                     COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
              FROM q_indicator_departments qid
              JOIN departments d ON d.id = qid.department_id
              ${departmentId != null ? 'WHERE d.id = ?' : ''}
              ORDER BY department_name`,
      values: departmentId != null ? [departmentId] : [],
    })) as { indicator_id: number; department_id: number; department_name: string }[];

    const fyRows = (await query({
      query: 'SELECT indicator_id, financial_year FROM q_indicator_fys ORDER BY indicator_id, financial_year',
    })) as { indicator_id: number; financial_year: string }[];

    const responseQuery =
      departmentId != null
        ? `SELECT r.indicator_id, r.metric_id, r.department_id, r.financial_year, r.value,
                  r.submitted_at, r.updated_at
           FROM q_responses r
           INNER JOIN q_indicator_submissions qis
             ON qis.indicator_id = r.indicator_id AND qis.department_id = r.department_id
           WHERE r.department_id = ? AND qis.hod_review_status = 'approved'`
        : `SELECT r.indicator_id, r.metric_id, r.department_id, r.financial_year, r.value,
                  r.submitted_at, r.updated_at
           FROM q_responses r
           INNER JOIN q_indicator_submissions qis
             ON qis.indicator_id = r.indicator_id AND qis.department_id = r.department_id
           WHERE qis.hod_review_status = 'approved'`;

    const responses = (await query({
      query: responseQuery,
      values: departmentId != null ? [departmentId] : [],
    })) as {
      indicator_id: number;
      metric_id: number;
      department_id: number;
      financial_year: string;
      value: string | null;
      submitted_at: string | null;
      updated_at: string | null;
    }[];

    const departments = (await query({
      query: `SELECT DISTINCT d.id, COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS name
              FROM q_indicator_departments qid
              JOIN departments d ON d.id = qid.department_id
              ORDER BY name`,
    })) as { id: number; name: string }[];

    const metricsMap = new Map<number, typeof metrics>();
    for (const m of metrics) {
      const indicatorId = Number(m.indicator_id);
      if (!metricsMap.has(indicatorId)) metricsMap.set(indicatorId, []);
      metricsMap.get(indicatorId)!.push({ ...m, id: Number(m.id), indicator_id: indicatorId });
    }

    const deptsMap = new Map<number, typeof deptRows>();
    for (const d of deptRows) {
      const indicatorId = Number(d.indicator_id);
      if (!deptsMap.has(indicatorId)) deptsMap.set(indicatorId, []);
      deptsMap.get(indicatorId)!.push({
        indicator_id: indicatorId,
        department_id: Number(d.department_id),
        department_name: d.department_name,
      });
    }

    const fysMap = new Map<number, string[]>();
    for (const f of fyRows) {
      const indicatorId = Number(f.indicator_id);
      if (!fysMap.has(indicatorId)) fysMap.set(indicatorId, []);
      fysMap.get(indicatorId)!.push(normalizeFinancialYear(f.financial_year));
    }

    const assignedIndicatorIds = new Set(deptRows.map((d) => Number(d.indicator_id)));
    const filteredIndicators = indicators
      .filter((ind) => assignedIndicatorIds.has(Number(ind.id)))
      .map((ind) => {
        const id = Number(ind.id);
        return {
          id,
          indicator_text: ind.indicator_text,
          is_locked: Boolean(ind.is_locked),
          outcome_type: ind.outcome_type,
          outcome_label: ind.outcome_label,
          metrics: metricsMap.get(id) ?? [],
          departments: (deptsMap.get(id) ?? []).map((d) => ({
            id: d.department_id,
            name: d.department_name,
          })),
          financial_years: fysMap.get(id) ?? [],
        };
      });

    return NextResponse.json({
      departments,
      indicators: filteredIndicators,
      responses: responses.map((r) => ({
        indicator_id: Number(r.indicator_id),
        metric_id: Number(r.metric_id),
        department_id: Number(r.department_id),
        financial_year: normalizeFinancialYear(r.financial_year),
        value: r.value,
        submitted_at: r.submitted_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (e) {
    console.error('admin questionnaire collected-data GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
