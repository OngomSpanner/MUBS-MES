import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import { durationTextToDays } from '@/lib/sds/codes';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

/** Update process activity (System Admin full control). */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const { id } = await context.params;
    const activityId = Number(id);
    if (!activityId) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

    const body = await request.json();
    const activityName = String(body.activity_name || '').trim();
    const durationText = String(body.duration_text || '').trim() || null;
    const sequenceNo = Number(body.sequence_no);

    if (!activityName) {
      return NextResponse.json({ message: 'activity_name required' }, { status: 400 });
    }

    const existing = (await query({
      query: 'SELECT id, output_id FROM sds_activities WHERE id = ?',
      values: [activityId],
    })) as { id: number; output_id: number }[];
    if (!existing.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    await query({
      query: `
        UPDATE sds_activities
        SET activity_name = ?,
            duration_text = ?,
            duration_days = ?,
            sequence_no = COALESCE(?, sequence_no)
        WHERE id = ?
      `,
      values: [
        activityName,
        durationText,
        durationTextToDays(durationText),
        Number.isFinite(sequenceNo) && sequenceNo > 0 ? sequenceNo : null,
        activityId,
      ],
    });

    return NextResponse.json({ message: 'Updated' });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Sequence conflict on this output' }, { status: 409 });
    }
    console.error('sds activities PUT', e);
    return NextResponse.json({ message: 'Error updating activity' }, { status: 500 });
  }
}

/**
 * Delete process activity. Cancels active assignments first so appraisal pull
 * does not keep dangling links; then hard-deletes the activity row.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const { id } = await context.params;
    const activityId = Number(id);
    if (!activityId) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

    const existing = (await query({
      query: 'SELECT id FROM sds_activities WHERE id = ?',
      values: [activityId],
    })) as { id: number }[];
    if (!existing.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    await query({
      query: `
        UPDATE sds_activity_assignments
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE activity_id = ? AND status = 'active'
      `,
      values: [activityId],
    });

    await query({
      query: 'DELETE FROM sds_activities WHERE id = ?',
      values: [activityId],
    });

    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    console.error('sds activities DELETE', e);
    return NextResponse.json({ message: 'Error deleting activity' }, { status: 500 });
  }
}
