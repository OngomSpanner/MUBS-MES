import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { HOD_UNIT_HEAD_LABEL } from '@/lib/hod-review-workflow-constants';
import { notifyHodsOfIndicatorSubmission, notifyAmbassadorOfIndicatorSubmission } from '@/lib/questionnaire-submission-notifications';

export const dynamic = 'force-dynamic';

async function indicatorIsComplete(indicatorId: number, departmentId: number): Promise<boolean> {
  const metrics = (await query({
    query: 'SELECT id FROM q_metrics WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { id: number }[];

  const fys = (await query({
    query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { financial_year: string }[];

  const total = metrics.length * fys.length;
  if (total === 0) return false;

  const responses = (await query({
    query: `SELECT metric_id, financial_year, value FROM q_responses
            WHERE indicator_id = ? AND department_id = ?`,
    values: [indicatorId, departmentId],
  })) as { metric_id: number; financial_year: string; value: string | null }[];

  const responseMap = new Map<string, string>();
  for (const r of responses) {
    responseMap.set(`${r.metric_id}_${r.financial_year}`, r.value ?? '');
  }

  let filled = 0;
  for (const m of metrics) {
    for (const fy of fys) {
      const v = (responseMap.get(`${m.id}_${fy.financial_year}`) ?? '').trim();
      if (v) filled += 1;
    }
  }
  return filled >= total;
}

/** POST: submit multiple completed indicators for HOD review in one action. */
export async function POST(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const rawIds: unknown[] = Array.isArray(body.indicator_ids) ? body.indicator_ids : [];
  const indicatorIds = [...new Set(rawIds.map((id) => Number(id)).filter((id) => id > 0))];

  if (!indicatorIds.length) {
    return NextResponse.json({ message: 'indicator_ids required' }, { status: 400 });
  }

  await ensureHodReviewWorkflowSchema();

  const submitted: number[] = [];
  const skipped: { id: number; reason: string }[] = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const indicatorId of indicatorIds) {
    const lockCheck = (await query({
      query: 'SELECT is_locked FROM q_indicators WHERE id = ?',
      values: [indicatorId],
    })) as { is_locked: number }[];
    if (!lockCheck.length) {
      skipped.push({ id: indicatorId, reason: 'Indicator not found' });
      continue;
    }
    if (lockCheck[0].is_locked) {
      skipped.push({ id: indicatorId, reason: 'Locked by administrator' });
      continue;
    }

    const assigned = (await query({
      query: 'SELECT 1 FROM q_indicator_departments WHERE indicator_id = ? AND department_id = ?',
      values: [indicatorId, auth.managedUnitId],
    })) as unknown[];
    if (!assigned.length) {
      skipped.push({ id: indicatorId, reason: 'Not assigned to your office' });
      continue;
    }

    const submissionRows = (await query({
      query: `SELECT hod_review_status FROM q_indicator_submissions
              WHERE indicator_id = ? AND department_id = ?`,
      values: [indicatorId, auth.managedUnitId],
    })) as { hod_review_status: string }[];
    const hodStatus = submissionRows[0]?.hod_review_status ?? 'draft';
    if (hodStatus === 'submitted' || hodStatus === 'approved') {
      skipped.push({ id: indicatorId, reason: 'Already submitted or approved' });
      continue;
    }

    const complete = await indicatorIsComplete(indicatorId, auth.managedUnitId);
    if (!complete) {
      skipped.push({ id: indicatorId, reason: 'Not all metrics are filled' });
      continue;
    }

    await query({
      query: `INSERT INTO q_indicator_submissions (indicator_id, department_id, hod_review_status, submitted_by, submitted_at)
              VALUES (?, ?, 'submitted', ?, ?)
              ON DUPLICATE KEY UPDATE
                hod_review_status = 'submitted',
                submitted_by = VALUES(submitted_by),
                submitted_at = VALUES(submitted_at)`,
      values: [indicatorId, auth.managedUnitId, auth.userId, now],
    });

    void notifyHodsOfIndicatorSubmission({
      indicatorId,
      departmentId: auth.managedUnitId,
      submittedByUserId: auth.userId,
      notifyAmbassador: false,
    });

    submitted.push(indicatorId);
  }

  if (!submitted.length) {
    const allAlreadySubmitted = skipped.length > 0
      && skipped.every((s) => s.reason === 'Already submitted or approved');
    const message = allAlreadySubmitted
      ? `These indicators are already awaiting ${HOD_UNIT_HEAD_LABEL} review or have been approved. Nothing to submit.`
      : `No indicators were submitted. Each must be complete, saved, and not already under ${HOD_UNIT_HEAD_LABEL} review.`;

    return NextResponse.json(
      {
        message,
        submitted,
        skipped,
      },
      { status: 422 },
    );
  }

  void notifyAmbassadorOfIndicatorSubmission({
    indicatorId: submitted[0],
    departmentId: auth.managedUnitId,
    submittedByUserId: auth.userId,
    indicatorCount: submitted.length,
  });

  return NextResponse.json({
    message: `Submitted ${submitted.length} indicator${submitted.length === 1 ? '' : 's'} for ${HOD_UNIT_HEAD_LABEL} review`,
    submitted,
    skipped,
  });
}
