import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

// PUT — update assignment status/commentary from HOD
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, commentary, start_date, end_date } = body;

    await query({
      query: `UPDATE staff_process_assignments SET status = ?, commentary = ?, start_date = ?, end_date = ? WHERE id = ?`,
      values: [status || 'pending', commentary || null, start_date || null, end_date || null, id]
    });

    return NextResponse.json({ message: 'Assignment updated' });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ message: 'Error updating assignment' }, { status: 500 });
  }
}

function isOpenByStartDate(start: string | null | undefined) {
  return start != null && String(start).trim() !== '';
}

// DELETE — remove an assignment (only if the process has not been opened: no start date)
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    const rows = (await query({
      query: `
        SELECT spa.id, spa.staff_id, spa.start_date
        FROM staff_process_assignments spa
        JOIN strategic_activities sa ON spa.activity_id = sa.id
        WHERE spa.id = ? AND sa.department_id IN (${placeholders})
        LIMIT 1
      `,
      values: [pid, ...departmentIds],
    })) as { id: number; staff_id: number | null; start_date: string | null }[];

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Process assignment not found' }, { status: 404 });
    }

    if (isOpenByStartDate(rows[0].start_date)) {
      return NextResponse.json(
        { message: 'Cannot remove an opened process. It has a start date / is in progress.' },
        { status: 400 }
      );
    }

    if (rows[0].staff_id == null) {
      try {
        const subOpen = (await query({
          query: `
            SELECT COUNT(*) AS c
            FROM staff_process_subtasks
            WHERE process_assignment_id = ? AND start_date IS NOT NULL
          `,
          values: [pid],
        })) as { c: number }[];
        if (subOpen.length && Number(subOpen[0]?.c) > 0) {
          return NextResponse.json(
            { message: 'Cannot remove: one or more duties under this assignment are already open.' },
            { status: 400 }
          );
        }
      } catch {
        /* table missing */
      }
    }

    try {
      await query({
        query: 'DELETE FROM staff_process_subtasks WHERE process_assignment_id = ?',
        values: [pid],
      });
    } catch {
      /* table may not exist on older schemas */
    }

    await query({
      query: 'DELETE FROM staff_process_assignments WHERE id = ?',
      values: [pid],
    });

    return NextResponse.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ message: 'Error deleting assignment' }, { status: 500 });
  }
}
