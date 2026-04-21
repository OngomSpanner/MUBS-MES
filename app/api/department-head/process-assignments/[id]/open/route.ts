import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { addDurationToStartDate } from '@/lib/process-duration';
import { assertPriorProcessStepsComplete, notifyStaffProcessStepOpened } from '@/lib/process-auto-open';
import { ensureStaffProcessAssignmentDurationColumns } from '@/lib/staff-process-assignments-schema';

/** HOD opens a process task: start/end computed from task duration within activity window. */
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
        await ensureStaffProcessAssignmentDurationColumns();

        const rows = await query({
            query: `
                SELECT spa.id, spa.start_date, spa.status,
                    COALESCE(sp.duration_value, st.duration_value) as standard_duration_value,
                    COALESCE(sp.duration_unit, st.duration_unit) as standard_duration_unit
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
            standard_duration_value: number | null;
            standard_duration_unit: string | null;
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
        if (row.standard_duration_value == null || String(row.standard_duration_unit || '').trim() === '') {
            return NextResponse.json(
                { message: 'This process has no standard duration configured yet. Ask admin to set Process Duration first.' },
                { status: 400 }
            );
        }
        const reqDurationValue = body?.duration_value;
        const reqDurationUnit = typeof body?.duration_unit === 'string' ? String(body.duration_unit).trim().toLowerCase() : '';
        const hasReqDurationValue = reqDurationValue != null && reqDurationValue !== '';
        const hasReqDurationUnit = reqDurationUnit !== '';
        if ((hasReqDurationValue && !hasReqDurationUnit) || (!hasReqDurationValue && hasReqDurationUnit)) {
            return NextResponse.json(
                { message: 'Set both duration value and duration unit.' },
                { status: 400 }
            );
        }
        const reqDvNum = hasReqDurationValue ? parseInt(String(reqDurationValue), 10) : null;
        if (reqDvNum != null && (!Number.isFinite(reqDvNum) || reqDvNum < 1)) {
            return NextResponse.json(
                { message: 'Duration value must be at least 1.' },
                { status: 400 }
            );
        }
        const dv = reqDvNum ?? row.standard_duration_value;
        const du = (hasReqDurationUnit ? reqDurationUnit : row.standard_duration_unit) ?? null;
        if (dv == null || String(du || '').trim() === '') {
            return NextResponse.json(
                {
                    message:
                        'This process task has no standard duration set. Ask admin to set process duration, then try again.',
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
        const standardLimitEnd = addDurationToStartDate(startDate, row.standard_duration_value, row.standard_duration_unit);
        if (endDate > standardLimitEnd) {
            return NextResponse.json(
                {
                    message:
                        `This process task duration exceeds the standard duration limit (${standardLimitEnd}). ` +
                        `Adjust task duration or start date.`,
                },
                { status: 400 }
            );
        }

        await query({
            query: `UPDATE staff_process_assignments SET start_date = ?, end_date = ?, status = 'in_progress', duration_value = ?, duration_unit = ? WHERE id = ?`,
            values: [startDate, endDate, dv, du, assignmentId],
        });

        await notifyStaffProcessStepOpened(assignmentId, startDate, endDate);

        return NextResponse.json({ message: 'Process opened', start_date: startDate, end_date: endDate });
    } catch (error: unknown) {
        console.error('Open process assignment:', error);
        return NextResponse.json({ message: 'Failed to open process' }, { status: 500 });
    }
}
