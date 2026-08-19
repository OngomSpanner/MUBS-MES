import { query } from '@/lib/db';
import type { AdminReturnTarget } from '@/lib/hod-review-workflow-constants';
import {
  notifyAmbassadorOfStrategyReturn,
  notifyHodsOfStrategyReturn,
} from '@/lib/questionnaire-submission-notifications';

export type StrategyReturnAction = 'return_to_ambassador' | 'return_to_hod';
export type StrategyReturnItem = { indicatorId: number; departmentId: number };

export const STRATEGY_RETURN_ACTIONS = ['return_to_ambassador', 'return_to_hod'] as const;

export function parseStrategyReturnAction(raw: unknown): StrategyReturnAction | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (STRATEGY_RETURN_ACTIONS as readonly string[]).includes(s) ? (s as StrategyReturnAction) : null;
}

export function parseStrategyReturnItems(raw: unknown): StrategyReturnItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: StrategyReturnItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const indicatorId = Number((row as StrategyReturnItem).indicatorId);
    const departmentId = Number((row as StrategyReturnItem).departmentId);
    if (!indicatorId || !departmentId) continue;
    const key = `${indicatorId}-${departmentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ indicatorId, departmentId });
  }
  return items;
}

export async function applyStrategyReturns(args: {
  reviewerUserId: number;
  items: StrategyReturnItem[];
  action: StrategyReturnAction;
  comment: string;
}): Promise<{
  reviewed: StrategyReturnItem[];
  skipped: (StrategyReturnItem & { reason: string })[];
  returnTarget: AdminReturnTarget;
  nextStatus: 'returned' | 'submitted';
}> {
  const returnTarget: AdminReturnTarget = args.action === 'return_to_ambassador' ? 'ambassador' : 'hod';
  const nextStatus = returnTarget === 'ambassador' ? 'returned' : 'submitted';
  const reviewed: StrategyReturnItem[] = [];
  const skipped: (StrategyReturnItem & { reason: string })[] = [];

  for (const item of args.items) {
    const existing = (await query({
      query: `SELECT hod_review_status, submitted_by FROM q_indicator_submissions
              WHERE indicator_id = ? AND department_id = ?`,
      values: [item.indicatorId, item.departmentId],
    })) as { hod_review_status: string; submitted_by: number | null }[];

    if (!existing.length) {
      skipped.push({ ...item, reason: 'Submission not found' });
      continue;
    }

    const currentStatus = existing[0].hod_review_status;
    if (currentStatus !== 'approved' && currentStatus !== 'submitted') {
      skipped.push({ ...item, reason: 'Only approved or HOD-submitted items can be returned' });
      continue;
    }

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
      values: [nextStatus, args.reviewerUserId, args.comment, returnTarget, item.indicatorId, item.departmentId],
    });

    const ambassadorUserId = existing[0].submitted_by;
    if (returnTarget === 'ambassador' && ambassadorUserId) {
      void notifyAmbassadorOfStrategyReturn({
        indicatorId: item.indicatorId,
        departmentId: item.departmentId,
        ambassadorUserId,
        reviewerUserId: args.reviewerUserId,
        comment: args.comment,
      });
    } else if (returnTarget === 'hod') {
      void notifyHodsOfStrategyReturn({
        indicatorId: item.indicatorId,
        departmentId: item.departmentId,
        reviewerUserId: args.reviewerUserId,
        comment: args.comment,
        ambassadorUserId: ambassadorUserId ?? undefined,
      });
    }

    reviewed.push(item);
  }

  return { reviewed, skipped, returnTarget, nextStatus };
}
