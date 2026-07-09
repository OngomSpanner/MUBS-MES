import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { ensureQuestionnaireObjectiveSchema, ensureQuestionnaireSubMetricsSchema } from '@/lib/questionnaire-schema';
import {
  ensureIndicatorTargetsSchema,
  loadIndicatorTargets,
} from '@/lib/questionnaire-metric-targets';
import { inputMetricsForIndicator } from '@/lib/questionnaire/metric-tree';

export const dynamic = 'force-dynamic';

/** Returns all performance indicators assigned to this ambassador's department,
 *  with metrics, FYs, and existing responses. */
export async function GET(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  await ensureHodReviewWorkflowSchema();
  await ensureQuestionnaireObjectiveSchema();
  await ensureQuestionnaireSubMetricsSchema();
  await ensureIndicatorTargetsSchema();

  const url = new URL(request.url);
  const fyFilter = url.searchParams.get('fy') || 'all';
  const uomFilter = url.searchParams.get('uom') || 'all';

  const indicators = await query({
    query: `SELECT i.id, i.indicator_text, i.is_locked,
                   o.type AS outcome_type, o.label AS outcome_label
            FROM q_indicators i
            JOIN q_outcomes o ON o.id = i.outcome_id
            JOIN q_indicator_departments qid ON qid.indicator_id = i.id
            WHERE qid.department_id = ?
            ORDER BY i.indicator_text`,
    values: [auth.managedUnitId],
  }) as any[];

  if (!indicators.length) return NextResponse.json([]);

  const indicatorIds = indicators.map((i: any) => i.id);
  const inClause = indicatorIds.map(() => '?').join(',');

  let metricsQuery = `SELECT id, indicator_id, metric_text, unit_of_measure,
                             parent_metric_id, aggregation, is_total, sort_order
                      FROM q_metrics WHERE indicator_id IN (${inClause})`;
  const metricsValues: any[] = [...indicatorIds];
  if (uomFilter !== 'all') {
    metricsQuery += ' AND unit_of_measure = ?';
    metricsValues.push(uomFilter);
  }
  metricsQuery += ' ORDER BY indicator_id, sort_order';
  const metrics = await query({ query: metricsQuery, values: metricsValues }) as any[];

  let fysQuery = `SELECT indicator_id, financial_year FROM q_indicator_fys WHERE indicator_id IN (${inClause})`;
  const fysValues: any[] = [...indicatorIds];
  if (fyFilter !== 'all') {
    fysQuery += ' AND financial_year = ?';
    fysValues.push(fyFilter);
  }
  const fys = await query({ query: fysQuery, values: fysValues }) as any[];

  const responses = await query({
    query: `SELECT metric_id, financial_year, value, submitted_at FROM q_responses
            WHERE indicator_id IN (${inClause}) AND department_id = ?`,
    values: [...indicatorIds, auth.managedUnitId],
  }) as any[];

  const submissionRows = await query({
    query: `SELECT indicator_id, hod_review_status, hod_review_comment
            FROM q_indicator_submissions
            WHERE indicator_id IN (${inClause}) AND department_id = ?`,
    values: [...indicatorIds, auth.managedUnitId],
  }) as { indicator_id: number; hod_review_status: string; hod_review_comment: string | null }[];

  const submissionMap = new Map(
    submissionRows.map((s) => [s.indicator_id, s])
  );

  const targetsByIndicator = new Map<number, Awaited<ReturnType<typeof loadIndicatorTargets>>>();
  for (const indicatorId of indicatorIds) {
    targetsByIndicator.set(indicatorId, await loadIndicatorTargets(indicatorId));
  }

  const metricsMap = new Map<number, any[]>();
  for (const m of metrics) {
    if (!metricsMap.has(m.indicator_id)) metricsMap.set(m.indicator_id, []);
    metricsMap.get(m.indicator_id)!.push(m);
  }

  const fysMap = new Map<number, string[]>();
  for (const f of fys) {
    if (!fysMap.has(f.indicator_id)) fysMap.set(f.indicator_id, []);
    fysMap.get(f.indicator_id)!.push(f.financial_year);
  }

  const responseMap = new Map<string, any>();
  for (const r of responses) {
    responseMap.set(`${r.metric_id}_${r.financial_year}`, r);
  }

  const result = indicators
    .map((ind: any) => {
      const indMetrics = metricsMap.get(ind.id) ?? [];
      const indFys = fysMap.get(ind.id) ?? [];
      // filter: if UoM filter active, skip indicators that have no matching metrics
      if (uomFilter !== 'all' && indMetrics.length === 0) return null;
      if (fyFilter !== 'all' && indFys.length === 0) return null;

      const inputMetrics = inputMetricsForIndicator(indMetrics);
      const total = inputMetrics.length * indFys.length;
      const filled = inputMetrics.reduce((acc: number, m: any) =>
        acc + indFys.filter((fy: string) => {
          const v = responseMap.get(`${m.id}_${fy}`)?.value;
          return v != null && String(v).trim() !== '';
        }).length, 0);

      const status = total === 0 ? 'not-started'
        : filled === 0 ? 'not-started'
        : filled < total ? 'partial'
        : 'complete';

      return {
        ...ind,
        is_locked: Boolean(ind.is_locked),
        metrics: indMetrics,
        targets: targetsByIndicator.get(ind.id) ?? [],
        financial_years: indFys,
        status,
        filled,
        total,
        department_id: auth.managedUnitId,
        department_name: auth.managedUnitName,
        hod_review_status: submissionMap.get(ind.id)?.hod_review_status ?? 'draft',
        hod_review_comment: submissionMap.get(ind.id)?.hod_review_comment ?? null,
      };
    })
    .filter(Boolean);

  // Sort: not-started → partial → complete
  const order = { 'not-started': 0, 'partial': 1, 'complete': 2 };
  result.sort((a: any, b: any) => (order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0));

  return NextResponse.json(result);
}
