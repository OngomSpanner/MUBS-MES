import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureActionTrackerSchema } from '@/lib/action-tracker/schema';
import { canAssignOnTeam, getActionActor, visibleTeamIds } from '@/lib/action-tracker/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const teamId = Number(new URL(request.url).searchParams.get('team_id') || 0);
    const visible = await visibleTeamIds(actor);
    if (teamId > 0) {
      const meetings = await query({
        query: `SELECT m.id, m.team_id, m.title, m.meeting_date, m.venue, m.notes, m.created_at, t.name AS team_name
                FROM action_meetings m
                JOIN action_teams t ON t.id = m.team_id
                WHERE m.team_id = ?
                ORDER BY m.meeting_date DESC, m.id DESC`,
        values: [teamId],
      });
      return NextResponse.json({ meetings });
    }
    let sql = `SELECT m.id, m.team_id, m.title, m.meeting_date, m.venue, m.notes, m.created_at, t.name AS team_name
               FROM action_meetings m
               JOIN action_teams t ON t.id = m.team_id`;
    const values: number[] = [];
    if (visible !== 'all') {
      if (visible.length === 0) return NextResponse.json({ meetings: [] });
      sql += ` WHERE m.team_id IN (${visible.map(() => '?').join(',')})`;
      values.push(...visible);
    }
    sql += ' ORDER BY m.meeting_date DESC, m.id DESC';
    const meetings = await query({ query: sql, values });
    return NextResponse.json({ meetings });
  } catch (e) {
    console.error('action-tracker meetings GET', e);
    return NextResponse.json({ message: 'Failed to load meetings' }, { status: 500 });
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
    const meetingDate = String(body.meeting_date || '').slice(0, 10);
    if (!teamId || !title || !meetingDate) {
      return NextResponse.json({ message: 'Team, title and date are required' }, { status: 400 });
    }
    if (!(await canAssignOnTeam(actor, teamId))) {
      return NextResponse.json({ message: 'Not allowed to record meetings' }, { status: 403 });
    }
    const ins = (await query({
      query: `INSERT INTO action_meetings (team_id, title, meeting_date, venue, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
      values: [teamId, title, meetingDate, String(body.venue || '').trim() || null, String(body.notes || '').trim() || null, actor.userId],
    })) as { insertId?: number };
    return NextResponse.json({ id: Number(ins.insertId) });
  } catch (e) {
    console.error('action-tracker meetings POST', e);
    return NextResponse.json({ message: 'Failed to save meeting' }, { status: 500 });
  }
}
