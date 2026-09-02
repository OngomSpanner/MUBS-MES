import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import { notifyStaffSdsAssignment } from '@/lib/sds/assignment-notify';

const STANDARD_CODE = 'CAT-ACTIONS';

export async function copyAssignedActionToSds(args: {
  actionId: number;
  assignedBy: number;
  assignedByName: string;
  skipNotify?: boolean;
}): Promise<number | null> {
  const rows = (await query({
    query: `SELECT id, title, deadline, assignee_user_id, office_department_id, sds_assignment_id
            FROM action_items WHERE id = ?`,
    values: [args.actionId],
  })) as {
    id: number;
    title: string;
    deadline: string | null;
    assignee_user_id: number | null;
    office_department_id: number | null;
    sds_assignment_id: number | null;
  }[];
  const row = rows[0];
  if (!row?.assignee_user_id) return null;
  if (row.sds_assignment_id) return Number(row.sds_assignment_id);
  return copyActionToSds({
    actionId: args.actionId,
    title: row.title,
    deadline: row.deadline,
    staffUserId: Number(row.assignee_user_id),
    departmentId: row.office_department_id != null ? Number(row.office_department_id) : null,
    assignedBy: args.assignedBy,
    assignedByName: args.assignedByName,
    skipNotify: args.skipNotify,
  });
}

export async function copyActionToSds(args: {
  actionId: number;
  title: string;
  deadline: string | null;
  staffUserId: number;
  departmentId: number | null;
  assignedBy: number;
  assignedByName: string;
  skipNotify?: boolean;
}): Promise<number> {
  await ensureSdsSchema();

  let standardId: number;
  const existing = (await query({
    query: 'SELECT id FROM sds_standards WHERE code = ? LIMIT 1',
    values: [STANDARD_CODE],
  })) as { id: number }[];
  if (existing[0]?.id) {
    standardId = Number(existing[0].id);
  } else {
    const ins = (await query({
      query: `INSERT INTO sds_standards (code, title, owner_label, purpose, pathway, pillar, is_active)
              VALUES (?, ?, ?, ?, ?, ?, 1)`,
      values: [
        STANDARD_CODE,
        'Committee and meeting actions',
        'Strategy',
        'Actions arising from committees and unit meetings, assigned to offices for execution.',
        'Committee Action Tracker',
        'Institutional effectiveness',
      ],
    })) as { insertId?: number };
    standardId = Number(ins.insertId);
  }

  const outputCode = `CAT-A${args.actionId}`;
  let outputId: number;
  const outExist = (await query({
    query: 'SELECT id FROM sds_outputs WHERE output_code = ? LIMIT 1',
    values: [outputCode],
  })) as { id: number }[];
  if (outExist[0]?.id) {
    outputId = Number(outExist[0].id);
  } else {
    const seqRows = (await query({
      query: 'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS n FROM sds_outputs WHERE standard_id = ?',
      values: [standardId],
    })) as { n: number }[];
    const ins = (await query({
      query: `INSERT INTO sds_outputs (standard_id, output_code, sequence_no, service_description)
              VALUES (?, ?, ?, ?)`,
      values: [standardId, outputCode, Number(seqRows[0]?.n || 1), args.title],
    })) as { insertId?: number };
    outputId = Number(ins.insertId);
  }

  let activityId: number;
  const actExist = (await query({
    query: 'SELECT id FROM sds_activities WHERE output_id = ? ORDER BY id ASC LIMIT 1',
    values: [outputId],
  })) as { id: number }[];
  if (actExist[0]?.id) {
    activityId = Number(actExist[0].id);
  } else {
    const ins = (await query({
      query: `INSERT INTO sds_activities (output_id, sequence_no, activity_name, duration_text)
              VALUES (?, 1, ?, ?)`,
      values: [outputId, args.title, args.deadline ? `Due ${String(args.deadline).slice(0, 10)}` : 'As agreed'],
    })) as { insertId?: number };
    activityId = Number(ins.insertId);
  }

  const existingAssign = (await query({
    query: `SELECT id FROM sds_activity_assignments
            WHERE activity_id = ? AND staff_user_id = ? AND status = 'active'
            LIMIT 1`,
    values: [activityId, args.staffUserId],
  })) as { id: number }[];
  let assignmentId = existingAssign[0]?.id != null ? Number(existingAssign[0].id) : 0;
  if (!assignmentId) {
    const assignIns = (await query({
      query: `INSERT INTO sds_activity_assignments
              (activity_id, staff_user_id, assigned_by, department_id, target_date, notes, status)
              VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      values: [
        activityId,
        args.staffUserId,
        args.assignedBy,
        args.departmentId,
        args.deadline,
        `Copied from Action Tracker #${args.actionId}`,
      ],
    })) as { insertId?: number };
    assignmentId = Number(assignIns.insertId);
  }

  await query({
    query: 'UPDATE action_items SET sds_assignment_id = ? WHERE id = ?',
    values: [assignmentId, args.actionId],
  });

  if (!args.skipNotify && !existingAssign[0]?.id) {
    await notifyStaffSdsAssignment({
      staffUserId: args.staffUserId,
      assignmentId,
      activityName: args.title,
      standardTitle: 'Committee and meeting actions',
      standardCode: STANDARD_CODE,
      pillar: 'Institutional effectiveness',
      durationText: args.deadline ? `Due ${String(args.deadline).slice(0, 10)}` : null,
      targetDate: args.deadline,
      assignedByName: args.assignedByName,
    });
  }

  return assignmentId;
}
