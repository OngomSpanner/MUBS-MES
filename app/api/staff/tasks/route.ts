import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        // Fetch assigned tasks from activity_assignments joined with strategic_activities
        const tasksQuery = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    sa.description,
                    aa.end_date as dueDate,
                    aa.status as db_status,
                    sa.priority,
                    sa.progress,
                    sa.parent_id,
                    p.status as parent_status,
                    d.name as unit_name
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE aa.assigned_to_user_id = ?
                ORDER BY aa.end_date ASC
            `,
            values: [decoded.userId]
        }) as any[];

        const statusMap: Record<string, string> = {
            'pending': 'Pending',
            'accepted': 'Pending',
            'in_progress': 'In Progress',
            'submitted': 'Under Review',
            'evaluated': 'Completed',
            'completed': 'Completed',
            'overdue': 'Delayed'
        };

        const enhancedTasks = tasksQuery.map((task: any) => ({
            ...task,
            status: statusMap[task.db_status] || 'Not Started',
            type: task.parent_id ? 'Strategic Task' : 'Other Duty',
            daysLeft: Math.ceil((new Date(task.dueDate || new Date()).getTime() - new Date().getTime()) / (1000 * 3600 * 24)),
            unit_name: task.unit_name || 'N/A'
        }));

        // Aggregated stats
        const stats = {
            assigned: enhancedTasks.length,
            overdue: enhancedTasks.filter((t: any) => t.daysLeft < 0 && t.status !== 'Completed').length,
            inProgress: enhancedTasks.filter((t: any) => t.status === 'In Progress' || (t.progress > 0 && t.status !== 'Completed')).length,
            completed: enhancedTasks.filter((t: any) => t.status === 'Completed').length
        };

        return NextResponse.json({ tasks: enhancedTasks, stats });
    } catch (error: any) {
        console.error('Staff Tasks API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff tasks', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
