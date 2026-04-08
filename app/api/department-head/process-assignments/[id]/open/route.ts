import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { addDurationToStartDate } from '@/lib/process-duration';
import { assertPriorProcessStepsComplete } from '@/lib/process-auto-open';

/** HOD opens a process (task): sets start date; due date = start + standard duration. */
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

        const rows = await query({
            query: `
                SELECT spa.id, spa.start_date, spa.status,
                    st.duration_value, st.duration_unit
                FROM staff_process_assignments spa
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                JOIN standards st ON sp.standard_id = st.id
                WHERE spa.id = ? AND sa.department_id IN (${placeholders})
            `,
            values: [assignmentId, ...departmentIds],
        }) as {
            id: number;
            start_date: string | null;
            status: string;
            duration_value: number | null;
            duration_unit: string | null;
        }[];

        if (rows.length === 0) {
            return NextResponse.json({ message: 'Process assignment not found' }, { status: 404 });
        }

        if (rows[0].start_date != null) {
            return NextResponse.json({ message: 'This process is already open' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const forceOpen = body?.force === true || body?.hod_override === true;

        if (!forceOpen) {
            const gate = await assertPriorProcessStepsComplete(assignmentId, departmentIds);
            if (!gate.ok) {
                return NextResponse.json({ message: gate.message }, { status: 400 });
            }
        }

        const row = rows[0];
        const dv = row.duration_value;
        const du = row.duration_unit;
        if (dv == null || String(du || '').trim() === '') {
            return NextResponse.json(
                {
                    message:
                        'This process has no duration set on the standard. Ask an admin to set the standard duration, then try again.',
                },
                { status: 400 }
            );
        }

        const startRaw = body?.start_date as string | undefined;

        const toYMD = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const startDate =
            startRaw && String(startRaw).trim() !== '' ? String(startRaw).slice(0, 10) : toYMD(new Date());
        const endDate = addDurationToStartDate(startDate, dv, du);

        await query({
            query: `UPDATE staff_process_assignments SET start_date = ?, end_date = ?, status = 'in_progress' WHERE id = ?`,
            values: [startDate, endDate, assignmentId],
        });

        return NextResponse.json({ message: 'Process opened', start_date: startDate, end_date: endDate });
    } catch (error: unknown) {
        console.error('Open process assignment:', error);
        return NextResponse.json({ message: 'Failed to open process' }, { status: 500 });
    }
}
