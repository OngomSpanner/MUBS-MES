import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureActionTrackerSchema } from '@/lib/action-tracker/schema';
import { canAssignOnTeam, getActionActor } from '@/lib/action-tracker/access';
import { copyAssignedActionToSds } from '@/lib/action-tracker/sds-link';

export const dynamic = 'force-dynamic';

const STATUSES = ['not_started', 'in_progress', 'done'] as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const id = Number((await ctx.params).id);
    const updates = await query({
      query: `SELECT u.id, u.action_id, u.user_id, u.status, u.comment, u.created_at, usr.full_name
              FROM action_item_updates u
              JOIN users usr ON usr.id = u.user_id
              WHERE u.action_id = ?
              ORDER BY u.id DESC`,
      values: [id],
    });
    return NextResponse.json({ updates });
  } catch (e) {
    console.error('action-tracker item GET', e);
    return NextResponse.json({ message: 'Failed to load updates' }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureActionTrackerSchema();
    const id = Number((await ctx.params).id);
    const rows = (await query({
      query: 'SELECT id, team_id, assignee_user_id FROM action_items WHERE id = ?',
      values: [id],
    })) as { id: number; team_id: number; assignee_user_id: number | null }[];
    const item = rows[0];
    if (!item) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const body = await request.json();
    const isAssignee = Number(item.assignee_user_id) === actor.userId;
    const canManage = await canAssignOnTeam(actor, Number(item.team_id));
    if (!isAssignee && !canManage) {
      return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
    }

    if (body.to_sds) {
      if (!canManage) return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
      const assignmentId = await copyAssignedActionToSds({
        actionId: id,
        assignedBy: actor.userId,
        assignedByName: actor.fullName,
      });
      if (!assignmentId) {
        return NextResponse.json({ message: 'Assign a person before copying to SDS.' }, { status: 400 });
      }
      return NextResponse.json({ ok: true, sds_assignment_id: assignmentId });
    }

    const status = (STATUSES as readonly string[]).includes(String(body.status)) ? body.status : null;
    const progress = body.progress_note != null ? String(body.progress_note) : null;
    const comment = String(body.comment || '').trim();

    if (canManage) {
      await query({
        query: `UPDATE action_items SET
                  minute_no = COALESCE(?, minute_no),
                  title = COALESCE(?, title),
                  assignee_user_id = COALESCE(?, assignee_user_id),
                  office_department_id = COALESCE(?, office_department_id),
                  deadline = COALESCE(?, deadline),
                  status = COALESCE(?, status),
                  progress_note = COALESCE(?, progress_note)
                WHERE id = ?`,
        values: [
          body.minute_no != null ? String(body.minute_no).trim() || null : null,
          body.title != null ? String(body.title).trim() || null : null,
          body.assignee_user_id != null ? Number(body.assignee_user_id) || null : null,
          body.office_department_id != null ? Number(body.office_department_id) || null : null,
          body.deadline != null ? String(body.deadline).slice(0, 10) || null : null,
          status,
          progress,
          id,
        ],
      });
    } else {
      await query({
        query: `UPDATE action_items SET status = COALESCE(?, status), progress_note = COALESCE(?, progress_note) WHERE id = ?`,
        values: [status, progress, id],
      });
    }

    if (comment || status) {
      await query({
        query: 'INSERT INTO action_item_updates (action_id, user_id, status, comment) VALUES (?, ?, ?, ?)',
        values: [id, actor.userId, status, comment || `Status: ${status || 'updated'}`],
      });
    }
    if (canManage) {
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('action-tracker item PATCH', e);
    return NextResponse.json({ message: 'Failed to update action' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const actor = await getActionActor();
    if (!actor) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const id = Number((await ctx.params).id);
    const rows = (await query({
      query: 'SELECT team_id FROM action_items WHERE id = ?',
      values: [id],
    })) as { team_id: number }[];
    if (!rows[0]) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (!(await canAssignOnTeam(actor, Number(rows[0].team_id)))) {
      return NextResponse.json({ message: 'Not allowed' }, { status: 403 });
    }
    await query({ query: 'DELETE FROM action_item_updates WHERE action_id = ?', values: [id] });
    await query({ query: 'DELETE FROM action_items WHERE id = ?', values: [id] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('action-tracker item DELETE', e);
    return NextResponse.json({ message: 'Failed to delete action' }, { status: 500 });
  }
}
