import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatRelative(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString();
}

const statusMap: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Pending',
    in_progress: 'In Progress',
    submitted: 'Under Review',
    evaluated: 'Completed',
    completed: 'Completed',
    overdue: 'Delayed',
    returned: 'Returned',
    incomplete: 'Incomplete',
    not_done: 'Not Done',
    draft_definition: 'Action Required',
};

function statusFromReportStatus(status: string | null): string | null {
    if (!status) return null;
    const s = (status + '').toLowerCase();
    if (s === 'evaluated' || s === 'completed') return 'Completed';
    if (s === 'incomplete') return 'Incomplete';
    if (s === 'not_done') return 'Not Done';
    if (s === 'returned') return 'Returned';
    return null;
}

type RawTaskRow = {
    id: number;
    title: string;
    description?: string | null;
    instruction?: string | null;
    dueDate: string | null;
    db_status: string;
    latest_report_status?: string | null;
    progress?: number | null;
    assignment_type: 'legacy' | 'process_task';
};

function enhanceTaskRows(rows: RawTaskRow[]) {
    return rows.map((task) => {
        const derivedStatus = statusFromReportStatus(task.latest_report_status ?? null);
        const status = derivedStatus ?? statusMap[String(task.db_status || '').toLowerCase()] ?? 'Not Started';
        const referenceDate = new Date(task.dueDate || new Date());
        const daysLeft = Math.ceil((referenceDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        return { ...task, status, daysLeft };
    });
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');
        const userId = decoded.userId;

        const userRows = await query({
            query: `
                SELECT u.full_name, u.position, d.name as department_name
                FROM users u
                LEFT JOIN departments d ON d.id = u.department_id
                WHERE u.id = ?
            `,
            values: [userId],
        }) as any[];
        const staffUser = userRows?.[0];
        const fullName = staffUser?.full_name?.trim() || 'Staff';
        const position = staffUser?.position?.trim() || null;
        const departmentName = staffUser?.department_name?.trim() || null;

        const legacyRows = (await query({
            query: `
                SELECT 
                    aa.id,
                    sa.title,
                    sa.description,
                    NULL as instruction,
                    COALESCE(aa.end_date, sa.end_date) as dueDate,
                    aa.status as db_status,
                    (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.activity_assignment_id = aa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                    sa.progress,
                    'legacy' as assignment_type
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                WHERE aa.assigned_to_user_id = ?
            `,
            values: [userId],
        })) as RawTaskRow[];

        const processAssignBase = `
                SELECT 
                    spa.id,
                    sp.step_name as title,
                    sa.description as description,
                    __PI_COL__
                    spa.end_date as dueDate,
                    spa.status as db_status,
                    (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.process_assignment_id = spa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                    0 as progress,
                    'process_task' as assignment_type
                FROM staff_process_assignments spa
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                JOIN standards st ON sp.standard_id = st.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                WHERE spa.staff_id = ? AND spa.start_date IS NOT NULL
            `;
        let processRows: RawTaskRow[];
        try {
            processRows = (await query({
                query: processAssignBase.replace('__PI_COL__', 'st.performance_indicator as instruction,\n                    '),
                values: [userId],
            })) as RawTaskRow[];
        } catch (e: unknown) {
            const err = e as { code?: string; errno?: number };
            if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
                processRows = (await query({
                    query: processAssignBase.replace('__PI_COL__', ''),
                    values: [userId],
                })) as RawTaskRow[];
                processRows = processRows.map((r) => ({ ...r, instruction: null }));
            } else {
                throw e;
            }
        }

        const enhancedTasks = enhanceTaskRows([...legacyRows, ...processRows]);

        const stats = {
            assigned: enhancedTasks.length,
            overdue: enhancedTasks.filter(
                (t) => t.daysLeft < 0 && t.status !== 'Completed' && t.status !== 'Under Review'
            ).length,
            inProgress: enhancedTasks.filter((t) => t.status === 'In Progress').length,
            completed: enhancedTasks.filter((t) => t.status === 'Completed').length,
        };

        const deadlines = enhancedTasks
            .filter((t) => t.status !== 'Completed')
            .sort((a, b) => {
                const dateA = new Date(a.dueDate || '9999-12-31').getTime();
                const dateB = new Date(b.dueDate || '9999-12-31').getTime();
                return dateA - dateB;
            })
            .slice(0, 10)
            .map((t) => {
                const displayStatus =
                    t.daysLeft < 0 ? 'Delayed' : t.status === 'Under Review' ? 'Under Review' : 'In Progress';
                const progress =
                    t.assignment_type === 'process_task'
                        ? t.status === 'Completed'
                            ? 100
                            : t.status === 'Under Review'
                              ? 50
                              : 0
                        : Number(t.progress || 0);
                return {
                    id: t.id,
                    title: t.title,
                    description: (t.description || t.instruction || '').toString(),
                    dueDate: t.dueDate,
                    status: displayStatus,
                    progress,
                    daysLeft: t.daysLeft,
                    assignment_type: t.assignment_type,
                };
            });

        const feedbackLegacy = (await query({
            query: `
                SELECT 
                    sr.id,
                    sa.title as report_name,
                    COALESCE(e.evaluation_date, sr.updated_at) as evaluated_at,
                    sr.status as db_status,
                    e.rating,
                    e.qualitative_feedback
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE aa.assigned_to_user_id = ?
                AND (sr.status IN ('evaluated', 'acknowledged') OR (sr.status = 'draft' AND e.id IS NOT NULL))
            `,
            values: [userId],
        })) as any[];

        const feedbackProcess = (await query({
            query: `
                SELECT 
                    sr.id,
                    CONCAT(sa.title, ' — ', sp.step_name) as report_name,
                    COALESCE(e.evaluation_date, sr.updated_at) as evaluated_at,
                    sr.status as db_status,
                    e.rating,
                    e.qualitative_feedback
                FROM staff_reports sr
                JOIN staff_process_assignments spa ON sr.process_assignment_id = spa.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE spa.staff_id = ?
                AND (sr.status IN ('evaluated', 'acknowledged') OR (sr.status = 'draft' AND e.id IS NOT NULL))
            `,
            values: [userId],
        })) as any[];

        const feedbackCombined = [...feedbackLegacy, ...feedbackProcess]
            .sort(
                (a, b) =>
                    new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime()
            )
            .slice(0, 5);

        const feedback = feedbackCombined.map((f: any) => {
            const status =
                f.db_status === 'evaluated' || f.db_status === 'acknowledged' ? 'Completed' : 'Returned';
            return {
                id: f.id,
                task: f.report_name,
                status,
                date: formatRelative(f.evaluated_at),
            };
        });

        return NextResponse.json({
            user: { fullName, position, departmentName },
            stats,
            deadlines,
            feedback,
        });
    } catch (error: any) {
        console.error('Staff Dashboard API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff dashboard data', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
