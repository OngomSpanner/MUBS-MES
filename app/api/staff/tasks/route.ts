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
                    aa.id,
                    sa.id as activity_id,
                    sa.title,
                    sa.description,
                    NULL as instruction,
                    COALESCE(sa.start_date, p.start_date) as startDate,
                    COALESCE(sa.end_date, p.end_date) as dueDate,
                    aa.status as db_status,
                    (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.activity_assignment_id = aa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                    sa.progress,
                    sa.parent_id,
                    sa.task_type,
                    sa.kpi_target_value,
                    sa.frequency,
                    p.title as activity_title,
                    p.status as parent_status,
                    d.name as unit_name,
                    'legacy' as assignment_type
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE aa.assigned_to_user_id = ?
            `,
            values: [decoded.userId]
        }) as any[];

        // Fetch process (standard_process) assignments
        const processAssignmentsQuery = await query({
            query: `
                SELECT 
                    spa.id,
                    sa.id as activity_id,
                    sp.step_name as title,
                    sa.description as description,
                    st.performance_indicator as instruction,
                    spa.start_date as startDate,
                    spa.end_date as dueDate,
                    spa.status as db_status,
                    (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.process_assignment_id = spa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                    0 as progress,
                    NULL as parent_id,
                    'process' as task_type,
                    NULL as kpi_target_value,
                    'once' as frequency,
                    sa.title as activity_title,
                    'Strategic Plan' as parent_status,
                    d.name as unit_name,
                    'process_task' as assignment_type
                FROM staff_process_assignments spa
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                JOIN standards st ON sp.standard_id = st.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE spa.staff_id = ? AND spa.start_date IS NOT NULL
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
            'overdue': 'Delayed',
            'returned': 'Returned',
            'incomplete': 'Incomplete',
            'not_done': 'Not Done',
            'draft_definition': 'Action Required'
        };

        const statusFromReportStatus = (status: string | null): string | null => {
            if (!status) return null;
            const s = (status + '').toLowerCase();
            if (s === 'evaluated' || s === 'completed') return 'Completed';
            if (s === 'incomplete') return 'Incomplete';
            if (s === 'not_done') return 'Not Done';
            if (s === 'returned') return 'Returned';
            return null;
        };

        const frequencyMap: Record<string, string> = {
            'once': 'Once',
            'daily': 'Daily Task',
            'weekly': 'Weekly Task',
            'monthly': 'Monthly Task'
        };

        const allTasks = [...tasksQuery, ...processAssignmentsQuery];

        // Sort by dueDate
        allTasks.sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31').getTime();
            const dateB = new Date(b.dueDate || '9999-12-31').getTime();
            return dateA - dateB;
        });

        // Timeline / days-left: always from this assignment's due date (process window or activity end),
        // not the strategic-plan fiscal year — so Notifications & Deadlines matches assigned work only.
        const enhancedTasks = allTasks.map((task: any) => {
            const derivedStatus = statusFromReportStatus(task.latest_report_status);
            const status = derivedStatus ?? statusMap[task.db_status] ?? 'Not Started';

            const isProcessTask = task.assignment_type === 'process_task';
            const referenceDate = new Date(task.dueDate || new Date());
            const daysLeft = Math.ceil((referenceDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));

            return {
                ...task,
                status,
                type: isProcessTask ? 'Process' : (frequencyMap[task.frequency] || (task.parent_id ? 'Weekly Task' : 'Once')),
                tier: task.parent_id ? 'weekly_task' : (isProcessTask ? 'process_task' : null),
                daysLeft,
                unit_name: task.unit_name || 'N/A'
            };
        });

        // Aggregated stats
        const stats = {
            assigned: enhancedTasks.length,
            overdue: enhancedTasks.filter((t: any) => t.daysLeft < 0 && t.status !== 'Completed' && t.status !== 'Under Review').length,
            inProgress: enhancedTasks.filter((t: any) => t.status === 'In Progress').length,
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
