import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getActionActor } from '@/lib/action-tracker/access';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const departmentId = Number(new URL(request.url).searchParams.get('department_id') || 0);
    const search = String(new URL(request.url).searchParams.get('q') || '').trim();
    let sql = `SELECT u.id, u.full_name, u.email, u.department_id, d.name AS department_name
               FROM users u
               LEFT JOIN departments d ON d.id = u.department_id
               WHERE u.status = 'Active'`;
    const values: unknown[] = [];
    if (departmentId > 0) {
      sql += ' AND (u.department_id = ? OR u.department_id IN (SELECT id FROM departments WHERE parent_id = ?))';
      values.push(departmentId, departmentId);
    }
    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      values.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY u.full_name ASC LIMIT 120';
    const people = await query({ query: sql, values });
    return NextResponse.json({ people });
  } catch (e) {
    console.error('action-tracker people GET', e);
    return NextResponse.json({ message: 'Failed to load people' }, { status: 500 });
  }
}
