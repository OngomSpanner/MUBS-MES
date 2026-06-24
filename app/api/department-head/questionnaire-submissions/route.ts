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

export async function GET(request: Request) {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const url = new URL(request.url);
    const indicatorId = Number(url.searchParams.get('indicatorId'));
    const departmentId = Number(url.searchParams.get('departmentId'));

    if (indicatorId && departmentId) {
      if (!auth.departmentIds.includes(departmentId)) {
        return NextResponse.json({ message: 'Not authorized for this department' }, { status: 403 });
      }

      const metrics = (await query({
        query: `SELECT id, metric_text, unit_of_measure, sort_order
                FROM q_metrics WHERE indicator_id = ? ORDER BY sort_order`,
        values: [indicatorId],
      })) as { id: number; metric_text: string; unit_of_measure: string; sort_order: number }[];

      const financialYears = (await query({
        query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ? ORDER BY financial_year',
        values: [indicatorId],
      })) as { financial_year: string }[];

      const responses = (await query({
        query: `SELECT metric_id, financial_year, value
                FROM q_responses
                WHERE indicator_id = ? AND department_id = ?`,
        values: [indicatorId, departmentId],
      })) as { metric_id: number; financial_year: string; value: string | null }[];

      const submission = (await query({
        query: `SELECT qis.hod_review_status, qis.hod_review_comment, qis.hod_reviewed_at,
                       ru.full_name AS reviewed_by_name
                FROM q_indicator_submissions qis
                LEFT JOIN users ru ON ru.id = qis.hod_reviewed_by
                WHERE qis.indicator_id = ? AND qis.department_id = ?`,
        values: [indicatorId, departmentId],
      })) as {
        hod_review_status: string;
        hod_review_comment: string | null;
        hod_reviewed_at: string | null;
        reviewed_by_name: string | null;
      }[];

      return NextResponse.json({
        metrics,
        financial_years: financialYears.map((r) => r.financial_year),
        responses,
        hod_review_status: submission[0]?.hod_review_status ?? null,
        hod_review_comment: submission[0]?.hod_review_comment ?? null,
        hod_reviewed_at: submission[0]?.hod_reviewed_at ?? null,
        reviewed_by_name: submission[0]?.reviewed_by_name ?? null,
      });
    }

    const placeholders = inPlaceholders(auth.departmentIds.length);
    const rows = (await query({
      query: `
        SELECT qid.indicator_id, qid.department_id,
               COALESCE(qis.hod_review_status, 'draft') AS hod_review_status,
               qis.submitted_at,
               i.indicator_text, o.type AS outcome_type, o.label AS outcome_label,
               COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name,
               u.full_name AS submitted_by_name,
               (SELECT COUNT(*) FROM q_metrics m WHERE m.indicator_id = i.id) AS metric_count,
               (SELECT COUNT(*) FROM q_indicator_fys f WHERE f.indicator_id = i.id) AS fy_count,
               (SELECT COUNT(*)
                FROM q_responses r
                WHERE r.indicator_id = i.id AND r.department_id = qid.department_id
                  AND r.value IS NOT NULL AND TRIM(r.value) <> '') AS filled
        FROM q_indicator_departments qid
        JOIN q_indicators i ON i.id = qid.indicator_id
        JOIN q_outcomes o ON o.id = i.outcome_id
        JOIN departments d ON d.id = qid.department_id
        LEFT JOIN q_indicator_submissions qis
          ON qis.indicator_id = qid.indicator_id AND qis.department_id = qid.department_id
        LEFT JOIN users u ON u.id = qis.submitted_by
        WHERE qid.department_id IN (${placeholders})
          AND (qis.hod_review_status IS NULL
               OR qis.hod_review_status IN ('draft', 'submitted', 'approved', 'returned'))
        ORDER BY
          CASE COALESCE(qis.hod_review_status, 'draft')
            WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
          qis.submitted_at DESC,
          i.indicator_text
      `,
      values: auth.departmentIds,
    })) as Record<string, unknown>[];

    const submissions = rows.map((row) => {
      const metricCount = Number(row.metric_count ?? 0);
      const fyCount = Number(row.fy_count ?? 0);
      return {
        ...row,
        filled: Number(row.filled ?? 0),
        total: metricCount * fyCount,
      };
    });

    return NextResponse.json({ submissions });
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
      return NextResponse.json({ message: 'Feedback required when requesting revision' }, { status: 400 });
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

    return NextResponse.json({ message: action === 'approve' ? 'Approved' : 'Sent back for revision' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error updating submission', detail: message }, { status: 500 });
  }
}
