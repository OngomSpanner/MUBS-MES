import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { notifyAmbassadorOfIndicatorReview, notifyAdminsOfIndicatorApprovals } from '@/lib/questionnaire-submission-notifications';

export const dynamic = 'force-dynamic';

type BulkItem = { indicatorId: number; departmentId: number };

async function authReviewer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (departmentIds.length === 0) {
    return { error: NextResponse.json({ message: 'No department assigned' }, { status: 403 }) };
  }
  return { userId: decoded.userId, departmentIds };
}

function parseItems(raw: unknown): BulkItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: BulkItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const indicatorId = Number((row as BulkItem).indicatorId);
    const departmentId = Number((row as BulkItem).departmentId);
    if (!indicatorId || !departmentId) continue;
    const key = `${indicatorId}-${departmentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ indicatorId, departmentId });
  }
  return items;
}

/** PATCH: approve or return multiple indicator submissions at once. */
export async function PATCH(request: Request) {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const body = await request.json();
    const items = parseItems(body.items);
    const action = String(body.action || '').trim();
    const comment = String(body.comment || '').trim();

    if (!items.length) {
      return NextResponse.json({ message: 'items array required' }, { status: 400 });
    }
    if (!['approve', 'return'].includes(action)) {
      return NextResponse.json({ message: 'action must be approve or return' }, { status: 400 });
    }
    if (action === 'return' && !comment) {
      return NextResponse.json({ message: 'Feedback required when requesting revision' }, { status: 400 });
    }

    const reviewed: BulkItem[] = [];
    const skipped: { indicatorId: number; departmentId: number; reason: string }[] = [];
    const status = action === 'approve' ? 'approved' : 'returned';

    for (const item of items) {
      if (!auth.departmentIds.includes(item.departmentId)) {
        skipped.push({ ...item, reason: 'Not authorized for this department' });
        continue;
      }

      const existing = (await query({
        query: `SELECT hod_review_status, submitted_by FROM q_indicator_submissions
                WHERE indicator_id = ? AND department_id = ?`,
        values: [item.indicatorId, item.departmentId],
      })) as { hod_review_status: string; submitted_by: number | null }[];

      if (!existing.length) {
        skipped.push({ ...item, reason: 'Submission not found' });
        continue;
      }
      if (existing[0].hod_review_status !== 'submitted') {
        skipped.push({ ...item, reason: 'Not awaiting review' });
        continue;
      }

      await query({
        query: `
          UPDATE q_indicator_submissions
          SET hod_review_status = ?, hod_reviewed_by = ?, hod_reviewed_at = NOW(), hod_review_comment = ?
          WHERE indicator_id = ? AND department_id = ?
        `,
        values: [status, auth.userId, comment || null, item.indicatorId, item.departmentId],
      });

      const ambassadorUserId = existing[0].submitted_by;
      if (ambassadorUserId) {
        void notifyAmbassadorOfIndicatorReview({
          indicatorId: item.indicatorId,
          departmentId: item.departmentId,
          ambassadorUserId,
          reviewerUserId: auth.userId,
          action: action as 'approve' | 'return',
          comment: comment || null,
        });
      }

      reviewed.push(item);
    }

    if (action === 'approve' && reviewed.length > 0) {
      void notifyAdminsOfIndicatorApprovals({
        items: reviewed,
        reviewerUserId: auth.userId,
      });
    }

    if (!reviewed.length) {
      return NextResponse.json(
        {
          message: 'No submissions were reviewed. Each must be awaiting review.',
          reviewed,
          skipped,
        },
        { status: 422 },
      );
    }

    const verb = action === 'approve' ? 'Approved' : 'Returned for revision';
    return NextResponse.json({
      message: `${verb} ${reviewed.length} submission${reviewed.length === 1 ? '' : 's'}`,
      reviewed,
      skipped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error updating submissions', detail: message }, { status: 500 });
  }
}
