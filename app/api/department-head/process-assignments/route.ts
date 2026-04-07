import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

async function getHodContext(token: string) {
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) return null;
  const users = await query({
    query: 'SELECT id, department_id FROM users WHERE id = ?',
    values: [decoded.userId]
  }) as any[];
  return users[0] || null;
}

// GET — all process assignments for activities in this HOD's department
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ctx = await getHodContext(token);
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const hodSelect = `
        SELECT 
          spa.id,
          spa.activity_id,
          spa.standard_process_id,
          spa.staff_id,
          spa.status,
          spa.actual_value,
          spa.commentary,
          spa.start_date,
          spa.end_date,
          spa.created_at,
          sp.step_name AS task_name,
          sp.step_order AS task_order,
          __PI_COL__
          sp.standard_id,
          st.title AS standard_title,
          sa.title AS activity_title,
          sa.pillar,
          sa.unit_of_measure,
          u.full_name AS staff_name,
          u.position AS staff_position
        FROM staff_process_assignments spa
        JOIN standard_processes sp ON spa.standard_process_id = sp.id
        JOIN standards st ON sp.standard_id = st.id
        JOIN strategic_activities sa ON spa.activity_id = sa.id
        JOIN users u ON spa.staff_id = u.id
        WHERE sa.department_id = ? OR sa.id IN (
          SELECT id FROM strategic_activities WHERE department_id = ? AND source = 'strategic_plan'
        )
        ORDER BY sp.step_order ASC, spa.created_at DESC
      `;
    let rows: any[];
    try {
      rows = (await query({
        query: hodSelect.replace('__PI_COL__', 'st.performance_indicator,\n          '),
        values: [ctx.department_id, ctx.department_id],
      })) as any[];
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        rows = (await query({
          query: hodSelect.replace('__PI_COL__', ''),
          values: [ctx.department_id, ctx.department_id],
        })) as any[];
        rows = rows.map((r) => ({ ...r, performance_indicator: null }));
      } else {
        throw e;
      }
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching process assignments:', error);
    return NextResponse.json({ message: 'Error fetching process assignments' }, { status: 500 });
  }
}

// POST — assign a standard process to one or more staff (bulk supported)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ctx = await getHodContext(token);
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { activity_id, standard_process_id, staff_id, staff_ids, start_date, end_date } = body;

    const rawIds: number[] = Array.isArray(staff_ids) && staff_ids.length > 0
      ? staff_ids.map((n: unknown) => Number(n)).filter((n) => !Number.isNaN(n))
      : (staff_id != null && staff_id !== '' ? [Number(staff_id)] : []);

    if (!activity_id || !standard_process_id || rawIds.length === 0) {
      return NextResponse.json(
        { message: 'activity_id, standard_process_id and staff_id or staff_ids[] are required' },
        { status: 400 }
      );
    }

    const deptId = ctx.department_id;

    const actRows = await query({
      query: 'SELECT id FROM strategic_activities WHERE id = ? AND department_id = ?',
      values: [activity_id, deptId],
    }) as { id: number }[];
    if (!actRows.length) {
      return NextResponse.json({ message: 'Activity not found or not in your department' }, { status: 403 });
    }

    const created: number[] = [];
    let skippedDuplicate = 0;
    let skippedInvalid = 0;

    for (const sid of rawIds) {
      const inDept = await query({
        query: 'SELECT id FROM users WHERE id = ? AND department_id = ?',
        values: [sid, deptId],
      }) as { id: number }[];
      if (!inDept.length) {
        skippedInvalid++;
        continue;
      }

      const dup = await query({
        query: `
          SELECT id FROM staff_process_assignments
          WHERE activity_id = ? AND standard_process_id = ? AND staff_id = ?
        `,
        values: [activity_id, standard_process_id, sid],
      }) as { id: number }[];
      if (dup.length > 0) {
        skippedDuplicate++;
        continue;
      }

      const result = await query({
        query: `
          INSERT INTO staff_process_assignments (activity_id, standard_process_id, staff_id, status, start_date, end_date)
          VALUES (?, ?, ?, 'pending', ?, ?)
        `,
        values: [activity_id, standard_process_id, sid, start_date || null, end_date || null],
      });
      created.push((result as any).insertId);
    }

    if (created.length === 0) {
      return NextResponse.json(
        {
          message:
            skippedDuplicate > 0 && skippedInvalid === 0
              ? 'All selected staff already have this step assigned'
              : 'No assignments created',
          created: 0,
          skippedDuplicate,
          skippedInvalid,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: `Assigned ${created.length} staff member(s)`,
        ids: created,
        created: created.length,
        skippedDuplicate,
        skippedInvalid,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error assigning process:', error);
    return NextResponse.json({ message: 'Error assigning process' }, { status: 500 });
  }
}
