import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

async function getHodContext(token: string) {
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) return null;
  const users = await query({
    query: 'SELECT id, department_id FROM users WHERE id = ?',
    values: [decoded.userId],
  }) as any[];
  return users[0] || null;
}

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const ctx = await getHodContext(token);
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

    // Ensure process assignment belongs to this department (via activity)
    const owns = await query({
      query: `
        SELECT spa.id
        FROM staff_process_assignments spa
        JOIN strategic_activities sa ON spa.activity_id = sa.id
        WHERE spa.id = ? AND sa.department_id = ?
        LIMIT 1
      `,
      values: [pid, ctx.department_id],
    }) as { id: number }[];
    if (!owns.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const rows = await query({
      query: `
        SELECT s.id, s.process_assignment_id, s.title, s.assigned_to, u.full_name as assigned_to_name,
               s.status, s.start_date, s.end_date, s.created_at, s.updated_at
        FROM staff_process_subtasks s
        JOIN users u ON s.assigned_to = u.id
        WHERE s.process_assignment_id = ?
        ORDER BY s.id ASC
      `,
      values: [pid],
    }) as any[];

    return NextResponse.json({ subtasks: rows });
  } catch (e) {
    console.error('process-assignments subtasks GET error', e);
    return NextResponse.json({ message: 'Error fetching subtasks' }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const ctx = await getHodContext(token);
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const assignedTo = Number(body?.assigned_to);
    if (!title) return NextResponse.json({ message: 'title is required' }, { status: 400 });
    if (!Number.isFinite(assignedTo) || assignedTo <= 0) return NextResponse.json({ message: 'assigned_to is required' }, { status: 400 });

    // Verify assignment belongs to dept and assignee is in dept
    const owns = await query({
      query: `
        SELECT spa.id
        FROM staff_process_assignments spa
        JOIN strategic_activities sa ON spa.activity_id = sa.id
        WHERE spa.id = ? AND sa.department_id = ?
        LIMIT 1
      `,
      values: [pid, ctx.department_id],
    }) as { id: number }[];
    if (!owns.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const inDept = await query({
      query: 'SELECT id FROM users WHERE id = ? AND department_id = ?',
      values: [assignedTo, ctx.department_id],
    }) as { id: number }[];
    if (!inDept.length) return NextResponse.json({ message: 'Staff not in your department' }, { status: 400 });

    const res = await query({
      query: `
        INSERT INTO staff_process_subtasks (process_assignment_id, title, assigned_to, status)
        VALUES (?, ?, ?, 'pending')
      `,
      values: [pid, title, assignedTo],
    });

    return NextResponse.json({ message: 'Created', id: (res as any).insertId }, { status: 201 });
  } catch (e) {
    console.error('process-assignments subtasks POST error', e);
    return NextResponse.json({ message: 'Error creating subtask' }, { status: 500 });
  }
}

