import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { ensureMetricCommentsSchema } from '@/lib/questionnaire-metric-comments';
import { ensureQuestionnaireSubMetricsSchema } from '@/lib/questionnaire-schema';
import {
  ensureIndicatorTargetsSchema,
  loadIndicatorTargets,
} from '@/lib/questionnaire-metric-targets';
import type { AdminReturnTarget } from '@/lib/hod-review-workflow-constants';
import {
  notifyAmbassadorOfStrategyReturn,
  notifyHodsOfStrategyReturn,
} from '@/lib/questionnaire-submission-notifications';

export const dynamic = 'force-dynamic';

async function requireStrategyAdmin(): Promise<{ userId: number; role?: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return { userId: decoded.userId, role: decoded.role };
}

const RETURN_ACTIONS = ['return_to_ambassador', 'return_to_hod'] as const;
type ReturnAction = (typeof RETURN_ACTIONS)[number];

function parseReturnAction(raw: unknown): ReturnAction | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (RETURN_ACTIONS as readonly string[]).includes(s) ? (s as ReturnAction) : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireStrategyAdmin();
    if (!auth) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    await ensureHodReviewWorkflowSchema();
    await ensureMetricCommentsSchema();
    await ensureQuestionnaireSubMetricsSchema();
    await ensureIndicatorTargetsSchema();

    const url = new URL(request.url);
    const indicatorId = Number(url.searchParams.get('indicatorId'));
    const departmentId = Number(url.searchParams.get('departmentId'));

    if (indicatorId && departmentId) {
      const metrics = (await query({
        query: `SELECT id, metric_text, unit_of_measure, parent_metric_id, aggregation, is_total, sort_order
                FROM q_metrics WHERE indicator_id = ? ORDER BY sort_order`,
        values: [indicatorId],
      })) as {
        id: number;
        metric_text: string;
        unit_of_measure: string;
        parent_metric_id: number | null;
        aggregation: string | null;
        is_total: number | null;
        sort_order: number;
      }[];

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

      const metricComments = (await query({
        query: `SELECT metric_id, comment FROM q_metric_comments
                WHERE indicator_id = ? AND department_id = ?`,
        values: [indicatorId, departmentId],
      })) as { metric_id: number; comment: string | null }[];

      const targets = await loadIndicatorTargets(indicatorId);

      const submission = (await query({
        query: `SELECT qis.hod_review_status, qis.hod_review_comment, qis.hod_reviewed_at,
                       qis.admin_review_comment, qis.admin_reviewed_at, qis.admin_return_target,
                       ru.full_name AS reviewed_by_name,
                       au.full_name AS admin_reviewed_by_name
                FROM q_indicator_submissions qis
                LEFT JOIN users ru ON ru.id = qis.hod_reviewed_by
                LEFT JOIN users au ON au.id = qis.admin_reviewed_by
                WHERE qis.indicator_id = ? AND qis.department_id = ?`,
        values: [indicatorId, departmentId],
      })) as {
        hod_review_status: string;
        hod_review_comment: string | null;
        hod_reviewed_at: string | null;
        admin_review_comment: string | null;
        admin_reviewed_at: string | null;
        admin_return_target: AdminReturnTarget | null;
        reviewed_by_name: string | null;
        admin_reviewed_by_name: string | null;
      }[];

      return NextResponse.json({
        metrics,
        financial_years: financialYears.map((r) => r.financial_year),
        responses,
        metric_comments: metricComments,
        targets,
        hod_review_status: submission[0]?.hod_review_status ?? null,
        hod_review_comment: submission[0]?.hod_review_comment ?? null,
        hod_reviewed_at: submission[0]?.hod_reviewed_at ?? null,
        reviewed_by_name: submission[0]?.reviewed_by_name ?? null,
        admin_review_comment: submission[0]?.admin_review_comment ?? null,
        admin_reviewed_at: submission[0]?.admin_reviewed_at ?? null,
        admin_return_target: submission[0]?.admin_return_target ?? null,
        admin_reviewed_by_name: submission[0]?.admin_reviewed_by_name ?? null,
      });
    }

    const statusFilter = String(url.searchParams.get('status') || 'approved').trim();
    const allowedStatuses = statusFilter === 'all'
      ? ['submitted', 'approved', 'returned']
      : statusFilter === 'approved'
        ? ['approved']
        : ['submitted', 'approved'];

    const placeholders = allowedStatuses.map(() => '?').join(', ');
    const rows = (await query({
      query: `
        SELECT qid.indicator_id, qid.department_id,
               COALESCE(qis.hod_review_status, 'draft') AS hod_review_status,
               qis.submitted_at, qis.admin_return_target, qis.admin_review_comment,
               i.indicator_text, o.type AS outcome_type, o.label AS outcome_label,
               o.strategic_pillar AS outcome_strategic_pillar,
               o.pillar_code AS outcome_pillar_code,
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
        JOIN q_indicator_submissions qis
          ON qis.indicator_id = qid.indicator_id AND qis.department_id = qid.department_id
        LEFT JOIN users u ON u.id = qis.submitted_by
        WHERE qis.hod_review_status IN (${placeholders})
        ORDER BY qis.submitted_at DESC, i.indicator_text
      `,
      values: allowedStatuses,
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
    return NextResponse.json({ message: 'Error loading submissions', detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireStrategyAdmin();
    if (!auth) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    await ensureHodReviewWorkflowSchema();

    const body = await request.json();
    const indicatorId = Number(body.indicatorId);
    const departmentId = Number(body.departmentId);
    const action = parseReturnAction(body.action);
    const comment = String(body.comment || '').trim();

    if (!indicatorId || !departmentId || !action) {
      return NextResponse.json({
        message: 'indicatorId, departmentId, and action (return_to_ambassador|return_to_hod) required',
      }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({
        message: 'Feedback comment is required when returning a submission',
      }, { status: 400 });
    }

    const existing = (await query({
      query: `SELECT hod_review_status, submitted_by FROM q_indicator_submissions
              WHERE indicator_id = ? AND department_id = ?`,
      values: [indicatorId, departmentId],
    })) as { hod_review_status: string; submitted_by: number | null }[];

    if (!existing.length) {
      return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
    }

    const currentStatus = existing[0].hod_review_status;
    if (currentStatus !== 'approved' && currentStatus !== 'submitted') {
      return NextResponse.json({
        message: 'Only approved or HOD-submitted items can be returned by Strategy',
      }, { status: 409 });
    }

    const returnTarget: AdminReturnTarget = action === 'return_to_ambassador' ? 'ambassador' : 'hod';
    const nextStatus = returnTarget === 'ambassador' ? 'returned' : 'submitted';

    await query({
      query: `
        UPDATE q_indicator_submissions
        SET hod_review_status = ?,
            admin_reviewed_by = ?,
            admin_reviewed_at = NOW(),
            admin_review_comment = ?,
            admin_return_target = ?
        WHERE indicator_id = ? AND department_id = ?
      `,
      values: [nextStatus, auth.userId, comment, returnTarget, indicatorId, departmentId],
    });

    const ambassadorUserId = existing[0].submitted_by;
    if (returnTarget === 'ambassador' && ambassadorUserId) {
      void notifyAmbassadorOfStrategyReturn({
        indicatorId,
        departmentId,
        ambassadorUserId,
        reviewerUserId: auth.userId,
        comment,
      });
    } else if (returnTarget === 'hod') {
      void notifyHodsOfStrategyReturn({
        indicatorId,
        departmentId,
        reviewerUserId: auth.userId,
        comment,
        ambassadorUserId: ambassadorUserId ?? undefined,
      });
    }

    return NextResponse.json({
      message: returnTarget === 'ambassador'
        ? 'Returned to ambassador for revision'
        : 'Returned to Head of Department for review',
      hod_review_status: nextStatus,
      admin_return_target: returnTarget,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error updating submission', detail: message }, { status: 500 });
  }
}
