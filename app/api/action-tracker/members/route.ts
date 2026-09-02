import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureActionTrackerSchema } from '@/lib/action-tracker/schema';
import { canEditTeam, getActionActor } from '@/lib/action-tracker/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const teamId = Number(new URL(request.url).searchParams.get('team_id'));
    if (!teamId) return NextResponse.json({ message: 'team_id required' }, { status: 400 });

    const members = await query({
      query: `SELECT m.id, m.team_id, m.seat_label, m.department_id, m.user_id, m.is_secretariat,
                     d.name AS department_name, u.full_name, u.email
              FROM action_team_members m
              LEFT JOIN departments d ON d.id = m.department_id
              LEFT JOIN users u ON u.id = m.user_id
              WHERE m.team_id = ?
              ORDER BY m.is_secretariat DESC, m.seat_label ASC`,
      values: [teamId],
    });
    return NextResponse.json({ members });
  } catch (e) {
    console.error('action-tracker members GET', e);
    return NextResponse.json({ message: 'Failed to load members' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const body = await request.json();
    const teamId = Number(body.team_id);
    if (!teamId) return NextResponse.json({ message: 'team_id required' }, { status: 400 });
    if (!(await canEditTeam(actor, teamId)) && !actor.isStrategy) {
      return NextResponse.json({ message: 'Not allowed to add members' }, { status: 403 });
    }
    const seat = String(body.seat_label || '').trim();
    if (!seat) return NextResponse.json({ message: 'Office / seat is required' }, { status: 400 });
    const ins = (await query({
      query: `INSERT INTO action_team_members (team_id, seat_label, department_id, user_id, is_secretariat)
              VALUES (?, ?, ?, ?, ?)`,
      values: [
        teamId,
        seat,
        body.department_id ? Number(body.department_id) : null,
        body.user_id ? Number(body.user_id) : null,
        body.is_secretariat ? 1 : 0,
      ],
    })) as { insertId?: number };
    return NextResponse.json({ id: Number(ins.insertId) });
  } catch (e) {
    console.error('action-tracker members POST', e);
    return NextResponse.json({ message: 'Failed to add member' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    const rows = (await query({
      query: 'SELECT team_id FROM action_team_members WHERE id = ?',
      values: [id],
    })) as { team_id: number }[];
    if (!rows[0]) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (!(await canEditTeam(actor, Number(rows[0].team_id))) && !actor.isStrategy) {
      return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
    }
    await query({
      query: `UPDATE action_team_members
              SET seat_label = COALESCE(?, seat_label),
                  department_id = ?,
                  user_id = ?,
                  is_secretariat = COALESCE(?, is_secretariat)
              WHERE id = ?`,
      values: [
        body.seat_label != null ? String(body.seat_label).trim() : null,
        body.department_id === '' || body.department_id == null ? null : Number(body.department_id),
        body.user_id === '' || body.user_id == null ? null : Number(body.user_id),
        body.is_secretariat == null ? null : body.is_secretariat ? 1 : 0,
        id,
      ],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('action-tracker members PATCH', e);
    return NextResponse.json({ message: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    const rows = (await query({
      query: 'SELECT team_id FROM action_team_members WHERE id = ?',
      values: [id],
    })) as { team_id: number }[];
    if (!rows[0]) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (!(await canEditTeam(actor, Number(rows[0].team_id))) && !actor.isStrategy) {
      return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
    }
    await query({ query: 'DELETE FROM action_team_members WHERE id = ?', values: [id] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('action-tracker members DELETE', e);
    return NextResponse.json({ message: 'Failed to remove member' }, { status: 500 });
  }
}
