import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch all activities as "tasks" for the staff member
        // In a real system, we would filter by assigned_to or department_id + user role
        const tasks = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    sa.description,
                    sa.end_date as dueDate,
                    sa.status,
                    sa.priority,
                    sa.progress,
                    sa.parent_id,
                    p.status as parent_status
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                ORDER BY sa.end_date ASC
            `
        }) as any[];

        // Enhance with dynamic properties
        const enhancedTasks = tasks.map(task => ({
            ...task,
            type: task.parent_id ? 'Strategic Task' : 'Other Duty',
            daysLeft: Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
        }));

        // Aggregated stats
        const stats = {
            assigned: enhancedTasks.length,
            overdue: enhancedTasks.filter(t => t.daysLeft < 0 && t.status !== 'Completed').length,
            inProgress: enhancedTasks.filter(t => t.status === 'In Progress' || (t.progress > 0 && t.status !== 'Completed')).length,
            completed: enhancedTasks.filter(t => t.status === 'Completed').length
        };

        return NextResponse.json({ tasks: enhancedTasks, stats });
    } catch (error: any) {
        console.error('Staff Tasks API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff tasks', detail: error.message },
            { status: 500 }
        );
    }
}
