import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    let departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json(
        { activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }
    departmentIds = departmentIds.map((id: number) => Number(id));

    const placeholders = inPlaceholders(departmentIds.length);

    // Departmental (operational) activities:
    // - Not linked to strategic plan (source IS NULL/empty)
    // - Not a child task (parent_id IS NULL)
    // - Owned by one of the visible departments
    const rows = (await query({
      query: `
        SELECT 
          sa.*,
          d.name as unit_name,
          (SELECT COUNT(*) FROM activity_assignments aa WHERE aa.activity_id = sa.id) as assigned_staff,
          (SELECT COUNT(*) FROM activity_assignments aa WHERE aa.activity_id = sa.id AND aa.status = 'submitted') as pending_submissions
        FROM strategic_activities sa
        LEFT JOIN departments d ON d.id = sa.department_id
        WHERE sa.department_id IN (${placeholders})
          AND sa.parent_id IS NULL
          AND COALESCE(sa.source, '') = ''
          AND sa.activity_type = 'detailed'
        ORDER BY sa.end_date ASC
      `,
      values: [...departmentIds],
    })) as any[];

    const dbStatusMap: Record<string, string> = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'On Track',
      overdue: 'Delayed',
    };

    const activities = (rows || []).map((a: any) => {
      const progress = a.progress != null ? Number(a.progress) : 0;
      const status = progress >= 100 ? 'On Track' : dbStatusMap[a.status] || a.status;
      return { ...a, progress, status };
    });

    const stats = {
      total: activities.length,
      onTrack: activities.filter((a: any) => a.status === 'On Track').length,
      inProgress: activities.filter((a: any) => a.status === 'In Progress').length,
      delayed: activities.filter((a: any) => a.status === 'Delayed').length,
    };

    return NextResponse.json(
      { activities, stats },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('Departmental Activities API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching departmental activities', detail: error.message },
      { status: 500 }
    );
  }
}

