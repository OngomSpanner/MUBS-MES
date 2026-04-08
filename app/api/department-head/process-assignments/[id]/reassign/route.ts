import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import {
    isValidReassignReasonCode,
    reassignReasonLabel,
} from '@/lib/process-reassign-reasons';

/** HOD reassigns a process (task) to another staff member with a reason code and optional details. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const assignmentId = parseInt(id, 10);
        if (Number.isNaN(assignmentId)) {
            return NextResponse.json({ message: 'Invalid assignment id' }, { status: 400 });
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

        // Legacy: single free-text `reason` (treat as other + details)
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
        const reasonForAudit =
            description && reasonCode !== 'other'
                ? `${label}. ${description}`
                : reasonCode === 'other'
                  ? description
                  : label;

        const rows = await query({
            query: `
                SELECT spa.id, spa.staff_id, spa.commentary, u.full_name AS from_name,
                       sp.step_name AS process_title, sa.title AS activity_title
                FROM staff_process_assignments spa
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN users u ON spa.staff_id = u.id
                WHERE spa.id = ? AND sa.department_id IN (${placeholders})
            `,
            values: [assignmentId, ...departmentIds],
        }) as {
            id: number;
            staff_id: number | null;
            commentary: string | null;
            from_name: string | null;
            process_title: string;
            activity_title: string;
        }[];

        if (rows.length === 0) {
            return NextResponse.json({ message: 'Process assignment not found' }, { status: 404 });
        }

        const row = rows[0];
        if (row.staff_id != null && row.staff_id === newStaffId) {
            return NextResponse.json({ message: 'Staff member is already assigned' }, { status: 400 });
        }

        const newUser = await query({
            query: `SELECT id, full_name FROM users WHERE id = ? AND department_id IN (${placeholders})`,
            values: [newStaffId, ...departmentIds],
        }) as { id: number; full_name: string }[];

        if (newUser.length === 0) {
            return NextResponse.json({ message: 'New assignee must be in your department' }, { status: 400 });
        }

        const stamp = new Date().toISOString().slice(0, 10);
        const fromLabel = row.from_name?.trim() || 'Previous assignee';
        const note = `[Reassigned ${stamp}] From ${fromLabel} to ${newUser[0].full_name}. Reason: ${reasonForAudit}`;
        const mergedComment = [row.commentary?.trim() || '', note].filter(Boolean).join('\n\n');

        await query({
            query: `
                UPDATE staff_process_assignments
                SET staff_id = ?, commentary = ?, start_date = NULL, end_date = NULL, status = 'pending'
                WHERE id = ?
            `,
            values: [newStaffId, mergedComment || note, assignmentId],
        });

        await query({
            query: 'DELETE FROM staff_reports WHERE process_assignment_id = ?',
            values: [assignmentId],
        });

        const processSnippet =
            (row.process_title || 'Process').length > 120
                ? `${(row.process_title || '').slice(0, 117)}…`
                : row.process_title || 'Process';
        const activitySnippet = row.activity_title || 'Activity';

        const reasonInMessage =
            reasonCode === 'other'
                ? `Other: ${description}`
                : description
                  ? `${label}. Details: ${description}`
                  : label;

        if (row.staff_id != null && row.staff_id !== newStaffId) {
            await query({
                query: `
                    INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
                    VALUES (?, 'Process task reassigned', ?, 'task', ?, 'warning', 0)
                `,
                values: [
                    row.staff_id,
                    `"${processSnippet}" under "${activitySnippet}" has been reassigned from you to ${newUser[0].full_name}. Reason: ${reasonInMessage}.`,
                    assignmentId,
                ],
            });
        }

        await query({
            query: `
                INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
                VALUES (?, 'New process task assignment', ?, 'task', ?, 'info', 0)
            `,
            values: [
                newStaffId,
                `You were assigned "${processSnippet}" under "${activitySnippet}" (reassigned from ${fromLabel}). Reason: ${reasonInMessage}.`,
                assignmentId,
            ],
        });

        return NextResponse.json({ message: 'Process reassigned', new_staff_id: newStaffId });
    } catch (error: unknown) {
        console.error('Reassign process:', error);
        return NextResponse.json({ message: 'Failed to reassign process' }, { status: 500 });
    }
}
