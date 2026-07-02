import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';
import { HOD_UNIT_HEAD_LABEL } from '@/lib/hod-review-workflow-constants';
import { notifyHodsOfIndicatorSubmission } from '@/lib/questionnaire-submission-notifications';
import { ensureMetricCommentsSchema } from '@/lib/questionnaire-metric-comments';
import {
  ensureMetricTargetsSchema,
  loadIndicatorTargets,
} from '@/lib/questionnaire-metric-targets';

export const dynamic = 'force-dynamic';

type ResponseEntry = { metric_id: number; financial_year: string; value: string };
type MetricCommentEntry = { metric_id: number; comment?: string | null };

async function saveMetricComments(
  indicatorId: number,
  departmentId: number,
  metricComments: MetricCommentEntry[],
): Promise<void> {
  if (!metricComments.length) return;

  const validMetrics = (await query({
    query: 'SELECT id FROM q_metrics WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { id: number }[];
  const validMetricIds = new Set(validMetrics.map((m) => m.id));

  for (const entry of metricComments) {
    const metricId = Number(entry.metric_id);
    if (!metricId || !validMetricIds.has(metricId)) continue;
    const comment = entry.comment != null ? String(entry.comment).trim() : '';
    if (!comment) {
      await query({
        query: 'DELETE FROM q_metric_comments WHERE metric_id = ? AND department_id = ?',
        values: [metricId, departmentId],
      });
      continue;
    }
    await query({
      query: `INSERT INTO q_metric_comments (indicator_id, metric_id, department_id, comment)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE comment = VALUES(comment)`,
      values: [indicatorId, metricId, departmentId, comment],
    });
  }
}

/** GET: load responses for a specific indicator for this ambassador's department */
export async function GET(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  await ensureMetricCommentsSchema();
  await ensureMetricTargetsSchema();

  const url = new URL(request.url);
  const indicatorId = url.searchParams.get('indicator_id');
  if (!indicatorId) return NextResponse.json({ message: 'indicator_id required' }, { status: 400 });

  const assigned = (await query({
    query: 'SELECT 1 FROM q_indicator_departments WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  })) as unknown[];
  if (!assigned.length) return NextResponse.json({ message: 'Not assigned' }, { status: 403 });

  const rows = (await query({
    query: 'SELECT id, metric_id, financial_year, value, submitted_at, updated_at FROM q_responses WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  })) as unknown[];

  const metricComments = (await query({
    query: `SELECT metric_id, comment FROM q_metric_comments
            WHERE indicator_id = ? AND department_id = ?`,
    values: [indicatorId, auth.managedUnitId],
  })) as { metric_id: number; comment: string | null }[];

  const targets = await loadIndicatorTargets(Number(indicatorId));

  return NextResponse.json({ responses: rows, metric_comments: metricComments, targets });
}

/** POST: save (upsert) responses for this ambassador's department */
export async function POST(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const indicatorId = Number(body.indicator_id);
  const entries: ResponseEntry[] = Array.isArray(body.entries) ? body.entries : [];
  const metricComments: MetricCommentEntry[] = Array.isArray(body.metric_comments) ? body.metric_comments : [];

  if (!indicatorId) return NextResponse.json({ message: 'indicator_id required' }, { status: 400 });

  const lockCheck = (await query({
    query: 'SELECT is_locked FROM q_indicators WHERE id=?',
    values: [indicatorId],
  })) as { is_locked: number }[];
  if (!lockCheck.length) return NextResponse.json({ message: 'Indicator not found' }, { status: 404 });
  if (lockCheck[0].is_locked) {
    return NextResponse.json({ message: 'This indicator is locked by administrator. Editing is not allowed.' }, { status: 403 });
  }

  const assigned = (await query({
    query: 'SELECT 1 FROM q_indicator_departments WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  })) as unknown[];
  if (!assigned.length) return NextResponse.json({ message: 'Not assigned to your department' }, { status: 403 });

  await ensureHodReviewWorkflowSchema();
  await ensureMetricCommentsSchema();
  const submitForReview = parseSubmitForReview(body);

  if (submitForReview) {
    const metrics = (await query({
      query: 'SELECT id FROM q_metrics WHERE indicator_id = ?',
      values: [indicatorId],
    })) as { id: number }[];
    const fys = (await query({
      query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ?',
      values: [indicatorId],
    })) as { financial_year: string }[];
    const total = metrics.length * fys.length;
    const filled = entries.filter((e) => String(e.value ?? '').trim() !== '').length;
    if (total === 0 || filled < total) {
      return NextResponse.json(
        { message: `Fill in all required metrics before submitting to ${HOD_UNIT_HEAD_LABEL}.` },
        { status: 422 },
      );
    }
  }

  const submissionRows = (await query({
    query: `SELECT hod_review_status FROM q_indicator_submissions
            WHERE indicator_id = ? AND department_id = ?`,
    values: [indicatorId, auth.managedUnitId],
  })) as { hod_review_status: string }[];
  const currentHodStatus = submissionRows[0]?.hod_review_status;
  if (currentHodStatus === 'submitted' || currentHodStatus === 'approved') {
    return NextResponse.json(
      { message: `This submission is under review or approved. View only until the ${HOD_UNIT_HEAD_LABEL} requests revision.` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  for (const entry of entries) {
    const metricId = Number(entry.metric_id);
    const fy = String(entry.financial_year || '').trim();
    const value = entry.value != null ? String(entry.value) : null;
    if (!metricId || !fy) continue;
    await query({
      query: `INSERT INTO q_responses (indicator_id, metric_id, department_id, financial_year, value, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE value=VALUES(value), submitted_at=VALUES(submitted_at)`,
      values: [indicatorId, metricId, auth.managedUnitId, fy, value, now],
    });
  }

  await saveMetricComments(indicatorId, auth.managedUnitId, metricComments);

  const hodStatus = hodStatusForAmbassadorSave(submitForReview);
  await query({
    query: `INSERT INTO q_indicator_submissions (indicator_id, department_id, hod_review_status, submitted_by, submitted_at)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              hod_review_status = VALUES(hod_review_status),
              submitted_by = VALUES(submitted_by),
              submitted_at = IF(VALUES(hod_review_status) = 'submitted', VALUES(submitted_at), submitted_at)`,
    values: [indicatorId, auth.managedUnitId, hodStatus, auth.userId, submitForReview ? now : null],
  });

  if (hodStatus === 'submitted') {
    void notifyHodsOfIndicatorSubmission({
      indicatorId,
      departmentId: auth.managedUnitId,
      submittedByUserId: auth.userId,
    });
  }

  return NextResponse.json({
    message: submitForReview ? `Submitted for ${HOD_UNIT_HEAD_LABEL} review` : 'Draft saved',
    hodReviewStatus: hodStatus,
  });
}
