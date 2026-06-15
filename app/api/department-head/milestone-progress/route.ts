import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { query } from '@/lib/db';
import { getMilestoneTasksForParentActivity, resolveParentStrategicActivityId } from '@/lib/milestone-progress';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    const activityIdRaw = new URL(req.url).searchParams.get('activityId');
    const activityId = activityIdRaw ? Number(activityIdRaw) : NaN;
    if (!Number.isFinite(activityId) || activityId <= 0) {
      return NextResponse.json({ message: 'activityId is required' }, { status: 400 });
    }

    const departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json({ message: 'No department' }, { status: 403 });
    }

    const placeholders = inPlaceholders(departmentIds.length);
    const owned = (await query({
      query: `
        SELECT sa.id
        FROM strategic_activities sa
        LEFT JOIN strategic_activities p ON sa.parent_id = p.id
        WHERE sa.id = ?
          AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
        LIMIT 1
      `,
      values: [activityId, ...departmentIds, ...departmentIds],
    })) as { id: number }[];

    if (owned.length === 0) {
      return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    }

    const parentId = (await resolveParentStrategicActivityId(activityId)) ?? activityId;
    const summary = await getMilestoneTasksForParentActivity(parentId);
    return NextResponse.json({ activityId, parentActivityId: parentId, ...summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Department-head milestone-progress GET error:', error);
    return NextResponse.json({ message: 'Error loading milestone progress', detail: message }, { status: 500 });
  }
}
