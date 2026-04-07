import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { sqlTopStrategicMain } from '@/lib/strategic-activity-sql';

export const dynamic = 'force-dynamic';

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

        let departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } });
        }
        departmentIds = departmentIds.map((id: number) => Number(id));

        const placeholders = inPlaceholders(departmentIds.length);
        // Main (parent) row only when this department OWNS it (sa.department_id in HOD's dept). When the goal was assigned to multiple units, other units get a "detailed" row; we show that via childQuery only, so we don't duplicate.
        const mainQuery = await query({
            query: `
                SELECT 
                    sa.*,
                    u.name as unit_name,
                    st.performance_indicator as standard_indicator,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id AND c.department_id IN (${placeholders})) as total_tasks,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id AND c.department_id IN (${placeholders}) AND c.status = 'completed') as completed_tasks,
                    COALESCE((
                        SELECT COUNT(*) FROM standard_processes sp
                        WHERE sp.standard_id = sa.standard_id
                    ), 0) AS process_tasks_total,
                    COALESCE((
                        SELECT COUNT(DISTINCT spa.standard_process_id)
                        FROM staff_process_assignments spa
                        WHERE spa.activity_id = sa.id
                          AND LOWER(TRIM(spa.status)) IN ('evaluated', 'completed')
                    ), 0) AS process_tasks_done,
                    NULL as parent_title
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                LEFT JOIN standards st ON sa.standard_id = st.id
                WHERE ${sqlTopStrategicMain('sa')} AND sa.department_id IN (${placeholders})
                ORDER BY sa.end_date ASC
            `,
            values: [...departmentIds, ...departmentIds, ...departmentIds]
        }) as any[];

        // Only Strategy Manager–assigned "detailed" copies (multi-dept same goal); exclude HOD-created tasks
        let childQuery: any[];
        try {
            childQuery = await query({
                query: `
                    SELECT 
                        sa.*,
                        u.name as unit_name,
                        st.performance_indicator as standard_indicator,
                        (SELECT COUNT(*) FROM strategic_activities c WHERE c.department_id = sa.department_id AND (c.parent_id = sa.id OR c.parent_id = sa.parent_id)) as total_tasks,
                        (SELECT COUNT(*) FROM strategic_activities c WHERE c.department_id = sa.department_id AND (c.parent_id = sa.id OR c.parent_id = sa.parent_id) AND c.status = 'completed') as completed_tasks,
                        COALESCE((
                            SELECT COUNT(*) FROM standard_processes sp
                            WHERE sp.standard_id = sa.standard_id
                        ), 0) AS process_tasks_total,
                        COALESCE((
                            SELECT COUNT(DISTINCT spa.standard_process_id)
                            FROM staff_process_assignments spa
                            WHERE spa.activity_id = sa.id
                              AND LOWER(TRIM(spa.status)) IN ('evaluated', 'completed')
                        ), 0) AS process_tasks_done,
                        p.title as parent_title
                    FROM strategic_activities sa
                    LEFT JOIN departments u ON sa.department_id = u.id
                    LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                    LEFT JOIN standards st ON sa.standard_id = st.id
                    WHERE sa.department_id IN (${placeholders}) AND sa.parent_id IS NOT NULL
                    AND COALESCE(sa.source, '') = 'strategic_plan'
                    ORDER BY sa.end_date ASC
                `,
                values: [...departmentIds]
            }) as any[];
        } catch (e: any) {
            if (e?.message?.includes('source') || e?.code === 'ER_BAD_FIELD_ERROR') {
                childQuery = [];
            } else {
                throw e;
            }
        }

        const activitiesQuery = [...mainQuery, ...childQuery];

        const dbStatusMap: Record<string, string> = {
            'pending': 'Not Started',
            'in_progress': 'In Progress',
            'completed': 'On Track',
            'overdue': 'Delayed'
        };

        // Progress and status: derive from sub-tasks if they exist, otherwise use stored DB values.
        const activities = activitiesQuery.map((a: any) => {
            const totalTasks = Number(a.total_tasks) || 0;
            const completedTasks = Number(a.completed_tasks) || 0;
            const storedProgress = a.progress != null ? Number(a.progress) : 0;
            
            // Dynamic progress if sub-tasks are found; otherwise fallback to stored progress (from evaluation)
            const progress = totalTasks > 0
                ? Math.round((completedTasks / totalTasks) * 100)
                : storedProgress;

            // Dynamic status if sub-tasks are found; otherwise fallback to mapped DB status
            const status = totalTasks > 0
                ? (progress >= 100 ? 'On Track' : progress > 0 ? 'In Progress' : (dbStatusMap[a.status] || a.status))
                : (dbStatusMap[a.status] || a.status);

            return {
                ...a,
                target_kpi: a.target_kpi || a.standard_indicator,
                progress,
                status
            };
        });

        // Calculate stats
        const stats = {
            total: activities.length,
            onTrack: activities.filter(a => a.status === 'On Track').length,
            inProgress: activities.filter(a => a.status === 'In Progress').length,
            delayed: activities.filter(a => a.status === 'Delayed').length
        };

        return NextResponse.json(
            { activities, stats },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
        );
    } catch (error: any) {
        console.error('Department Activities API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department activities', detail: error.message },
            { status: 500 }
        );
    }
}
