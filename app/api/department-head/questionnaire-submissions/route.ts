import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const placeholders = inPlaceholders(auth.departmentIds.length);
    const rows = (await query({
      query: `
        SELECT qis.indicator_id, qis.department_id, qis.hod_review_status, qis.submitted_at,
               i.indicator_text, o.type AS outcome_type, o.label AS outcome_label,
               COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name,
               u.full_name AS submitted_by_name
        FROM q_indicator_submissions qis
        JOIN q_indicators i ON i.id = qis.indicator_id
        JOIN q_outcomes o ON o.id = i.outcome_id
        JOIN departments d ON d.id = qis.department_id
        LEFT JOIN users u ON u.id = qis.submitted_by
        WHERE qis.department_id IN (${placeholders})
          AND qis.hod_review_status IN ('submitted', 'approved', 'returned')
        ORDER BY
          CASE qis.hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END,
          qis.submitted_at DESC
      `,
      values: auth.departmentIds,
    })) as Record<string, unknown>[];

    return NextResponse.json({ submissions: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error loading questionnaire submissions', detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const body = await request.json();
    const indicatorId = Number(body.indicatorId);
    const departmentId = Number(body.departmentId);
    const action = String(body.action || '').trim();
    const comment = String(body.comment || '').trim();

    if (!indicatorId || !departmentId || !['approve', 'return'].includes(action)) {
      return NextResponse.json({ message: 'indicatorId, departmentId, and action (approve|return) required' }, { status: 400 });
    }
    if (action === 'return' && !comment) {
      return NextResponse.json({ message: 'Comment required when returning' }, { status: 400 });
    }

    if (!auth.departmentIds.includes(departmentId)) {
      return NextResponse.json({ message: 'Not authorized for this department' }, { status: 403 });
    }

    const status = action === 'approve' ? 'approved' : 'returned';
    await query({
      query: `
        UPDATE q_indicator_submissions
        SET hod_review_status = ?, hod_reviewed_by = ?, hod_reviewed_at = NOW(), hod_review_comment = ?
        WHERE indicator_id = ? AND department_id = ?
      `,
      values: [status, auth.userId, comment || null, indicatorId, departmentId],
    });

    return NextResponse.json({ message: action === 'approve' ? 'Approved' : 'Returned to ambassador' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error updating submission', detail: message }, { status: 500 });
  }
}
