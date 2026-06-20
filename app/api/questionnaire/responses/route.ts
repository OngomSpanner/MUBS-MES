import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';

export const dynamic = 'force-dynamic';

/** GET: load responses for a specific indicator for this ambassador's department */
export async function GET(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const indicatorId = url.searchParams.get('indicator_id');
  if (!indicatorId) return NextResponse.json({ message: 'indicator_id required' }, { status: 400 });

  // Check indicator is assigned to this department
  const assigned = await query({
    query: 'SELECT 1 FROM q_indicator_departments WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  }) as any[];
  if (!assigned.length) return NextResponse.json({ message: 'Not assigned' }, { status: 403 });

  const rows = await query({
    query: 'SELECT id, metric_id, financial_year, value, submitted_at, updated_at FROM q_responses WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  }) as any[];

  return NextResponse.json(rows);
}

/** POST: save (upsert) responses for this ambassador's department */
export async function POST(request: Request) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const indicatorId = Number(body.indicator_id);
  const entries: { metric_id: number; financial_year: string; value: string }[] = Array.isArray(body.entries) ? body.entries : [];

  if (!indicatorId) return NextResponse.json({ message: 'indicator_id required' }, { status: 400 });

  // Check lock
  const lockCheck = await query({
    query: 'SELECT is_locked FROM q_indicators WHERE id=?',
    values: [indicatorId],
  }) as any[];
  if (!lockCheck.length) return NextResponse.json({ message: 'Indicator not found' }, { status: 404 });
  if (lockCheck[0].is_locked) return NextResponse.json({ message: 'This indicator is locked by administrator. Editing is not allowed.' }, { status: 403 });

  // Check assignment
  const assigned = await query({
    query: 'SELECT 1 FROM q_indicator_departments WHERE indicator_id=? AND department_id=?',
    values: [indicatorId, auth.managedUnitId],
  }) as any[];
  if (!assigned.length) return NextResponse.json({ message: 'Not assigned to your department' }, { status: 403 });

  await ensureHodReviewWorkflowSchema();
  const submitForReview = parseSubmitForReview(body);
  if (submitForReview) {
    const locked = await query({
      query: `SELECT 1 FROM q_indicator_submissions
              WHERE indicator_id = ? AND department_id = ? AND hod_review_status = 'submitted'`,
      values: [indicatorId, auth.managedUnitId],
    }) as unknown[];
    if (locked.length) {
      return NextResponse.json(
        { message: 'This indicator is awaiting HOD review. Wait for approval or return before editing.' },
        { status: 409 }
      );
    }
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

  return NextResponse.json({
    message: submitForReview ? 'Submitted for HOD review' : 'Draft saved',
    hodReviewStatus: hodStatus,
  });
}
