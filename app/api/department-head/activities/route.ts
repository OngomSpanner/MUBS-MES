import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        // Fetch main activities (parent_id IS NULL) for visible departments
        const mainQuery = await query({
            query: `
                SELECT 
                    sa.*,
                    u.name as unit_name,
                    (SELECT COUNT(*) FROM strategic_activities WHERE parent_id = sa.id) as total_tasks,
                    (SELECT COUNT(*) FROM strategic_activities WHERE parent_id = sa.id AND status = 'completed') as completed_tasks,
                    NULL as parent_title
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                WHERE sa.department_id IN (${placeholders}) AND sa.parent_id IS NULL
                ORDER BY sa.end_date ASC
            `,
            values: [...departmentIds]
        }) as any[];

        // Fetch detailed/child activities in visible departments
        const childQuery = await query({
            query: `
                SELECT 
                    sa.*,
                    u.name as unit_name,
                    1 as total_tasks,
                    IF(sa.status = 'completed', 1, 0) as completed_tasks,
                    p.title as parent_title
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                WHERE sa.department_id IN (${placeholders}) AND sa.parent_id IS NOT NULL
                ORDER BY sa.end_date ASC
            `,
            values: [...departmentIds]
        }) as any[];

        const activitiesQuery = [...mainQuery, ...childQuery];

        const dbStatusMap: Record<string, string> = {
            'pending': 'Not Started',
            'in_progress': 'In Progress',
            'completed': 'On Track',
            'overdue': 'Delayed'
        };

        const activities = activitiesQuery.map((a: any) => ({
            ...a,
            status: dbStatusMap[a.status] || a.status
        }));

        // Calculate stats
        const stats = {
            total: activities.length,
            onTrack: activities.filter(a => a.status === 'On Track').length,
            inProgress: activities.filter(a => a.status === 'In Progress').length,
            delayed: activities.filter(a => a.status === 'Delayed').length
        };

        return NextResponse.json({
            activities,
            stats
        });
    } catch (error: any) {
        console.error('Department Activities API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department activities', detail: error.message },
            { status: 500 }
        );
    }
}
