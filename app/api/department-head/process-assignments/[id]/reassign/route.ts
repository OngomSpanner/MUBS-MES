import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

/** HOD reassigns a process (task) to another staff member with a required reason. */
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
        const reason = String(body?.reason ?? '').trim();

        if (!Number.isFinite(newStaffId) || newStaffId <= 0) {
            return NextResponse.json({ message: 'new_staff_id is required' }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ message: 'reason is required for reassignment' }, { status: 400 });
        }

        const rows = await query({
            query: `
                SELECT spa.id, spa.staff_id, spa.commentary, u.full_name as from_name
                FROM staff_process_assignments spa
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                JOIN users u ON spa.staff_id = u.id
                WHERE spa.id = ? AND sa.department_id IN (${placeholders})
            `,
            values: [assignmentId, ...departmentIds],
        }) as { id: number; staff_id: number; commentary: string | null; from_name: string }[];

        if (rows.length === 0) {
            return NextResponse.json({ message: 'Process assignment not found' }, { status: 404 });
        }

        const row = rows[0];
        if (row.staff_id === newStaffId) {
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
        const note = `[Reassigned ${stamp}] From ${row.from_name} to ${newUser[0].full_name}. Reason: ${reason}`;
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

        return NextResponse.json({ message: 'Process reassigned', new_staff_id: newStaffId });
    } catch (error: unknown) {
        console.error('Reassign process:', error);
        return NextResponse.json({ message: 'Failed to reassign process' }, { status: 500 });
    }
}
