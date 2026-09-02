import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureActionTrackerSchema } from '@/lib/action-tracker/schema';
import { canEditTeam, getActionActor, unitScopeIds, visibleTeamIds } from '@/lib/action-tracker/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();

    const visible = await visibleTeamIds(actor);
    let sql = `
      SELECT t.id, t.name, t.kind, t.department_id, t.description, t.is_active, t.created_at,
             d.name AS department_name,
             (SELECT COUNT(*) FROM action_team_members m WHERE m.team_id = t.id) AS member_count,
             (SELECT COUNT(*) FROM action_items i WHERE i.team_id = t.id) AS action_count,
             (SELECT COUNT(*) FROM action_items i WHERE i.team_id = t.id AND i.status = 'done') AS done_count
      FROM action_teams t
      LEFT JOIN departments d ON d.id = t.department_id
      WHERE t.is_active = 1
    `;
    const values: number[] = [];
    if (visible !== 'all') {
      if (visible.length === 0) return NextResponse.json({ teams: [], actor });
      sql += ` AND t.id IN (${visible.map(() => '?').join(',')})`;
      values.push(...visible);
    }
    sql += ' ORDER BY t.kind ASC, t.name ASC';
    const teams = await query({ query: sql, values });
    return NextResponse.json({ teams, actor: { ...actor, canCreateCommittee: actor.isStrategy, canCreateDepartmental: actor.isHod || actor.isStrategy } });
  } catch (e) {
    console.error('action-tracker teams GET', e);
    return NextResponse.json({ message: 'Failed to load teams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const body = await request.json();
    const name = String(body.name || '').trim();
    const kind = String(body.kind || 'committee');
    const description = String(body.description || '').trim() || null;
    if (!name) return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    if (!['committee', 'departmental', 'adhoc'].includes(kind)) {
      return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
    }
    if (kind === 'committee' && !actor.isStrategy) {
      return NextResponse.json({ message: 'Only Strategy can create school committees.' }, { status: 403 });
    }
    let departmentId = body.department_id != null ? Number(body.department_id) : null;
    if (kind === 'departmental') {
      if (!actor.isStrategy && !actor.isHod) {
        return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
      }
      if (!actor.isStrategy) {
        const scope = await unitScopeIds(actor);
        departmentId = actor.managedUnitId || actor.departmentId;
        if (!departmentId || (scope.length && !scope.includes(departmentId))) {
          return NextResponse.json({ message: 'Select your unit' }, { status: 400 });
        }
      }
    }
    const ins = (await query({
      query: `INSERT INTO action_teams (name, kind, department_id, description, created_by)
              VALUES (?, ?, ?, ?, ?)`,
      values: [name, kind, kind === 'departmental' ? departmentId : null, description, actor.userId],
    })) as { insertId?: number };
    return NextResponse.json({ id: Number(ins.insertId) });
  } catch (e) {
    console.error('action-tracker teams POST', e);
    return NextResponse.json({ message: 'Failed to create team' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 });
    if (!(await canEditTeam(actor, id)) && !actor.isStrategy) {
      return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
    }
    const name = String(body.name || '').trim();
    const description = body.description != null ? String(body.description) : undefined;
    const isActive = body.is_active;
    if (name) {
      await query({ query: 'UPDATE action_teams SET name = ? WHERE id = ?', values: [name, id] });
    }
    if (description !== undefined) {
      await query({ query: 'UPDATE action_teams SET description = ? WHERE id = ?', values: [description, id] });
    }
    if (isActive === 0 || isActive === 1 || isActive === true || isActive === false) {
      await query({
        query: 'UPDATE action_teams SET is_active = ? WHERE id = ?',
        values: [isActive ? 1 : 0, id],
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('action-tracker teams PATCH', e);
    return NextResponse.json({ message: 'Failed to update team' }, { status: 500 });
  }
}
