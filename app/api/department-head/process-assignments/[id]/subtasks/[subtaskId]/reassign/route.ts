import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import {
    isValidReassignReasonCode,
    reassignReasonLabel,
} from '@/lib/process-reassign-reasons';

/** HOD reassigns a single sub-task under a container process assignment. */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string; subtaskId: string }> }
) {
    try {
        const { id, subtaskId } = await context.params;
        const assignmentId = parseInt(id, 10);
        const stId = parseInt(subtaskId, 10);
        if (Number.isNaN(assignmentId) || Number.isNaN(stId)) {
            return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const decoded = verifyToken(token) as { userId?: number } | null;
        if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ message: 'No department' }, { status: 403 });
        }
        const placeholders = inPlaceholders(departmentIds.length);

        const body = await request.json();
        const newStaffId = body?.new_staff_id != null ? Number(body.new_staff_id) : NaN;

        let reasonCode = String(body?.reason_code ?? '').trim();
        let description = String(body?.description ?? '').trim();
        const legacyReason = String(body?.reason ?? '').trim();
        if (!reasonCode && legacyReason) {
            reasonCode = 'other';
            description = legacyReason;
        }

        if (!Number.isFinite(newStaffId) || newStaffId <= 0) {
            return NextResponse.json({ message: 'new_staff_id is required' }, { status: 400 });
        }
        if (!isValidReassignReasonCode(reasonCode)) {
            return NextResponse.json({ message: 'Select a valid reassignment reason' }, { status: 400 });
        }
        if (reasonCode === 'other' && !description) {
            return NextResponse.json(
                { message: 'Please add a short description when the reason is “Other”' },
                { status: 400 }
            );
        }

        const label = reassignReasonLabel(reasonCode)!;
        const reasonInMessage =
            reasonCode === 'other'
                ? `Other: ${description}`
                : description
                  ? `${label}. Details: ${description}`
                  : label;

        const rows = await query({
            query: `
                SELECT s.id, s.process_assignment_id, s.title AS subtask_title, s.assigned_to, s.status AS subtask_status,
                       u.full_name AS from_name,
                       sp.step_name AS process_title,
                       sa.title AS activity_title,
                       spa.staff_id AS parent_staff_id
                FROM staff_process_subtasks s
                JOIN staff_process_assignments spa ON s.process_assignment_id = spa.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN users u ON s.assigned_to = u.id
                WHERE s.id = ? AND spa.id = ? AND sa.department_id IN (${placeholders})
            `,
            values: [stId, assignmentId, ...departmentIds],
        }) as {
            id: number;
            process_assignment_id: number;
            subtask_title: string;
            assigned_to: number | null;
            subtask_status: string | null;
            from_name: string | null;
            process_title: string;
            activity_title: string;
            parent_staff_id: number | null;
        }[];

        if (rows.length === 0) {
            return NextResponse.json({ message: 'Sub-task not found' }, { status: 404 });
        }

        const row = rows[0];

        if (row.parent_staff_id != null) {
            return NextResponse.json(
                { message: 'This assignment is not a sub-task breakdown; use process reassignment instead.' },
                { status: 400 }
            );
        }

        const st = String(row.subtask_status || '').toLowerCase().trim();
        if (st === 'completed' || st === 'evaluated') {
            return NextResponse.json(
                { message: 'Cannot reassign a completed or evaluated sub-task' },
                { status: 400 }
            );
        }

        if (row.assigned_to != null && row.assigned_to === newStaffId) {
            return NextResponse.json({ message: 'Staff member is already assigned to this sub-task' }, { status: 400 });
        }

        const newUser = await query({
            query: `SELECT id, full_name FROM users WHERE id = ? AND department_id IN (${placeholders})`,
            values: [newStaffId, ...departmentIds],
        }) as { id: number; full_name: string }[];

        if (newUser.length === 0) {
            return NextResponse.json({ message: 'New assignee must be in your department' }, { status: 400 });
        }

        const processSnippet =
            (row.process_title || 'Process').length > 100
                ? `${(row.process_title || '').slice(0, 97)}…`
                : row.process_title || 'Process';
        const subSnippet =
            (row.subtask_title || 'Sub-task').length > 120
                ? `${(row.subtask_title || '').slice(0, 117)}…`
                : row.subtask_title || 'Sub-task';
        const activitySnippet = row.activity_title || 'Activity';
        const fromLabel = row.from_name?.trim() || 'Previous assignee';

        await query({
            query: `
                UPDATE staff_process_subtasks
                SET assigned_to = ?, status = 'pending', start_date = NULL, end_date = NULL
                WHERE id = ?
            `,
            values: [newStaffId, stId],
        });

        try {
            await query({
                query: 'DELETE FROM staff_reports WHERE process_subtask_id = ?',
                values: [stId],
            });
        } catch {
            /* process_subtask_id column may be missing on older DBs */
        }

        if (row.assigned_to != null && row.assigned_to !== newStaffId) {
            await query({
                query: `
                    INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
                    VALUES (?, 'Sub-task reassigned', ?, 'task', ?, 'warning', 0)
                `,
                values: [
                    row.assigned_to,
                    `Sub-task "${subSnippet}" (under "${processSnippet}", ${activitySnippet}) was reassigned from you to ${newUser[0].full_name}. Reason: ${reasonInMessage}.`,
                    assignmentId,
                ],
            });
        }

        await query({
            query: `
                INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
                VALUES (?, 'New sub-task assignment', ?, 'task', ?, 'info', 0)
            `,
            values: [
                newStaffId,
                `You were assigned sub-task "${subSnippet}" under "${processSnippet}" (${activitySnippet}), reassigned from ${fromLabel}. Reason: ${reasonInMessage}.`,
                assignmentId,
            ],
        });

        return NextResponse.json({ message: 'Sub-task reassigned', new_staff_id: newStaffId });
    } catch (error: unknown) {
        console.error('Reassign subtask:', error);
        return NextResponse.json({ message: 'Failed to reassign sub-task' }, { status: 500 });
    }
}
