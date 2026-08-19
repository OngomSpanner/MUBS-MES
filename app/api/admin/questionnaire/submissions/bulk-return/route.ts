import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import {
  applyStrategyReturns,
  parseStrategyReturnAction,
  parseStrategyReturnItems,
} from '@/lib/questionnaire/strategy-return';

export const dynamic = 'force-dynamic';

async function requireStrategyAdmin(): Promise<{ userId: number; role?: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return { userId: decoded.userId, role: decoded.role };
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireStrategyAdmin();
    if (!auth) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    await ensureHodReviewWorkflowSchema();

    const body = await request.json();
    const items = parseStrategyReturnItems(body.items);
    const action = parseStrategyReturnAction(body.action);
    const comment = String(body.comment || '').trim();

    if (!items.length) {
      return NextResponse.json({ message: 'items array required' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({
        message: 'action (return_to_ambassador|return_to_hod) required',
      }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({
        message: 'Feedback comment is required when returning submissions',
      }, { status: 400 });
    }

    const result = await applyStrategyReturns({
      reviewerUserId: auth.userId,
      items,
      action,
      comment,
    });

    if (!result.reviewed.length) {
      return NextResponse.json(
        {
          message: 'No submissions were returned. Each must be approved or awaiting HOD review.',
          reviewed: result.reviewed,
          skipped: result.skipped,
        },
        { status: 422 },
      );
    }

    const dest = result.returnTarget === 'ambassador' ? 'ambassador' : 'Head of Department';
    let message = `Returned ${result.reviewed.length} indicator${result.reviewed.length === 1 ? '' : 's'} to ${dest}`;
    if (result.skipped.length > 0) {
      message += ` (${result.skipped.length} skipped)`;
    }

    return NextResponse.json({
      message,
      reviewed: result.reviewed,
      skipped: result.skipped,
      admin_return_target: result.returnTarget,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error returning submissions', detail: message }, { status: 500 });
  }
}
