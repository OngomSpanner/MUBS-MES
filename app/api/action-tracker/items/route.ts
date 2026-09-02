import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureActionTrackerSchema } from '@/lib/action-tracker/schema';
import { canAssignOnTeam, getActionActor, visibleTeamIds } from '@/lib/action-tracker/access';
import { notifyActionAssigned } from '@/lib/action-tracker/notify';
import { copyAssignedActionToSds } from '@/lib/action-tracker/sds-link';

export const dynamic = 'force-dynamic';

const STATUSES = ['not_started', 'in_progress', 'done'] as const;

export async function GET(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const sp = new URL(request.url).searchParams;
    const teamId = Number(sp.get('team_id') || 0);
    const mine = sp.get('mine') === '1';
    const visible = await visibleTeamIds(actor);

    let sql = `
      SELECT i.id, i.team_id, i.meeting_id, i.minute_no, i.title, i.assignee_user_id,
             i.office_department_id, i.deadline, i.status, i.progress_note, i.sds_assignment_id,
             i.created_at, i.updated_at,
             t.name AS team_name, t.kind AS team_kind,
             m.title AS meeting_title, m.meeting_date,
             u.full_name AS assignee_name,
             d.name AS office_name
      FROM action_items i
      JOIN action_teams t ON t.id = i.team_id
      LEFT JOIN action_meetings m ON m.id = i.meeting_id
      LEFT JOIN users u ON u.id = i.assignee_user_id
      LEFT JOIN departments d ON d.id = i.office_department_id
      WHERE 1=1
    `;
    const values: unknown[] = [];
    if (mine) {
      sql += ' AND i.assignee_user_id = ?';
      values.push(actor.userId);
    } else if (teamId > 0) {
      sql += ' AND i.team_id = ?';
      values.push(teamId);
    } else if (visible !== 'all') {
      if (visible.length === 0) return NextResponse.json({ items: [] });
      sql += ` AND i.team_id IN (${visible.map(() => '?').join(',')})`;
      values.push(...visible);
    }
    sql += ' ORDER BY (i.deadline IS NULL), i.deadline ASC, i.id DESC';
    const items = await query({ query: sql, values });
    return NextResponse.json({ items });
  } catch (e) {
    console.error('action-tracker items GET', e);
    return NextResponse.json({ message: 'Failed to load actions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const body = await request.json();
    const teamId = Number(body.team_id);
    const title = String(body.title || '').trim();
    if (!teamId || !title) return NextResponse.json({ message: 'Team and action are required' }, { status: 400 });
    if (!(await canAssignOnTeam(actor, teamId))) {
      return NextResponse.json({ message: 'Not allowed to assign actions' }, { status: 403 });
    }
    const status = (STATUSES as readonly string[]).includes(String(body.status)) ? body.status : 'not_started';
    const ins = (await query({
      query: `INSERT INTO action_items
              (team_id, meeting_id, minute_no, title, assignee_user_id, office_department_id, deadline, status, progress_note, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        teamId,
        body.meeting_id ? Number(body.meeting_id) : null,
        String(body.minute_no || '').trim() || null,
        title,
        body.assignee_user_id ? Number(body.assignee_user_id) : null,
        body.office_department_id ? Number(body.office_department_id) : null,
        body.deadline ? String(body.deadline).slice(0, 10) : null,
        status,
        String(body.progress_note || '').trim() || null,
        actor.userId,
      ],
    })) as { insertId?: number };
    const id = Number(ins.insertId);
    if (body.assignee_user_id) {
      const teams = (await query({
        query: 'SELECT name FROM action_teams WHERE id = ?',
        values: [teamId],
      })) as { name: string }[];
      await notifyActionAssigned({
        userId: Number(body.assignee_user_id),
        actionId: id,
        title,
        teamName: String(teams[0]?.name || 'Committee'),
        deadline: body.deadline ? String(body.deadline).slice(0, 10) : null,
        assignedBy: actor.fullName,
      });
      try {
        await copyAssignedActionToSds({
          actionId: id,
          assignedBy: actor.userId,
          assignedByName: actor.fullName,
        });
      } catch (err) {
        console.error('action-tracker auto SDS copy failed', err);
      }
    }
    return NextResponse.json({ id });
  } catch (e) {
    console.error('action-tracker items POST', e);
    return NextResponse.json({ message: 'Failed to save action' }, { status: 500 });
  }
}
