import { query } from '@/lib/db';

export { defaultMilestoneProgressForStep } from '@/lib/milestone-progress-utils';

let ensuredMilestoneColumn = false;

export async function ensureMilestoneProgressColumn(): Promise<void> {
  if (ensuredMilestoneColumn) return;
  try {
    await query({
      query:
        'ALTER TABLE standard_processes ADD COLUMN milestone_progress TINYINT UNSIGNED NULL DEFAULT NULL COMMENT "Cumulative % when this step is complete"',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  ensuredMilestoneColumn = true;
}

/**
 * Progress from standard process milestones: highest cumulative milestone_progress
 * among evaluated/completed process steps on this activity tree.
 */
/** True when the activity's standard defines cumulative milestone weights on process steps. */
export async function parentActivityHasMilestoneTemplate(
  parentActivityId: number
): Promise<boolean> {
  await ensureMilestoneProgressColumn();
  const rows = (await query({
    query: `
      SELECT 1
      FROM strategic_activities sa
      JOIN standard_processes sp ON sp.standard_id = sa.standard_id
      WHERE sa.id = ? AND sp.milestone_progress IS NOT NULL
      LIMIT 1
    `,
    values: [parentActivityId],
  })) as { 1: number }[];
  return rows.length > 0;
}

export async function computeMilestoneProgressForStrategicActivity(
  strategicActivityId: number
): Promise<number | null> {
  await ensureMilestoneProgressColumn();

  const rows = (await query({
    query: `
      SELECT MAX(sp.milestone_progress) AS max_progress
      FROM staff_process_assignments spa
      JOIN strategic_activities sa ON spa.activity_id = sa.id
      JOIN standard_processes sp ON spa.standard_process_id = sp.id
      WHERE (sa.id = ? OR sa.parent_id = ?)
        AND spa.status IN ('evaluated', 'completed')
        AND sp.milestone_progress IS NOT NULL
    `,
    values: [strategicActivityId, strategicActivityId],
  })) as { max_progress: number | null }[];

  const max = rows[0]?.max_progress;
  if (max == null) return null;
  const n = Number(max);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
}

export async function applyMilestoneProgressToStrategicActivity(
  strategicActivityId: number
): Promise<{ progress: number; updated: boolean } | null> {
  const milestoneProgress = await computeMilestoneProgressForStrategicActivity(strategicActivityId);
  if (milestoneProgress == null) return null;

  const status = milestoneProgress >= 100 ? 'completed' : 'in_progress';
  const result = (await query({
    query: 'UPDATE strategic_activities SET progress = ?, status = ? WHERE id = ?',
    values: [milestoneProgress, status, strategicActivityId],
  })) as { affectedRows?: number };

  return {
    progress: milestoneProgress,
    updated: Number(result.affectedRows ?? 0) > 0,
  };
}

/** Parent strategic activity id for milestone rollup (parent row when child exists). */
export async function resolveParentStrategicActivityId(activityId: number): Promise<number | null> {
  const rows = (await query({
    query: 'SELECT id, parent_id FROM strategic_activities WHERE id = ? LIMIT 1',
    values: [activityId],
  })) as { id: number; parent_id: number | null }[];
  const row = rows[0];
  if (!row) return null;
  return row.parent_id != null ? Number(row.parent_id) : Number(row.id);
}

export async function recalcParentMilestoneFromActivityId(
  activityId: number
): Promise<{ progress: number; updated: boolean } | null> {
  const parentId = await resolveParentStrategicActivityId(activityId);
  if (parentId == null) return null;
  return applyMilestoneProgressToStrategicActivity(parentId);
}

export async function recalcParentMilestoneFromProcessAssignmentId(
  processAssignmentId: number
): Promise<{ progress: number; updated: boolean } | null> {
  const rows = (await query({
    query: 'SELECT activity_id FROM staff_process_assignments WHERE id = ? LIMIT 1',
    values: [processAssignmentId],
  })) as { activity_id: number }[];
  const activityId = rows[0]?.activity_id;
  if (activityId == null) return null;
  return recalcParentMilestoneFromActivityId(Number(activityId));
}

export type MilestoneStepStatus = {
  stepOrder: number;
  stepName: string;
  milestoneProgress: number | null;
  assignmentStatus: string | null;
  completed: boolean;
};

/** Ordered process steps + assignment status for a parent strategic activity. */
export async function getMilestoneStepsForParentActivity(
  parentActivityId: number
): Promise<{ parentProgress: number | null; steps: MilestoneStepStatus[] }> {
  await ensureMilestoneProgressColumn();

  const parent = (await query({
    query: 'SELECT id, standard_id, progress FROM strategic_activities WHERE id = ? LIMIT 1',
    values: [parentActivityId],
  })) as { id: number; standard_id: number | null; progress: number | null }[];

  const standardId = parent[0]?.standard_id;
  if (!standardId) {
    return { parentProgress: parent[0]?.progress != null ? Number(parent[0].progress) : null, steps: [] };
  }

  let steps: MilestoneStepStatus[] = [];
  try {
    const rows = (await query({
      query: `
        SELECT
          sp.step_order,
          sp.step_name,
          sp.milestone_progress,
          (
            SELECT spa.status
            FROM staff_process_assignments spa
            JOIN strategic_activities sa ON spa.activity_id = sa.id
            WHERE spa.standard_process_id = sp.id
              AND (sa.id = ? OR sa.parent_id = ?)
            ORDER BY spa.updated_at DESC
            LIMIT 1
          ) AS assignment_status
        FROM standard_processes sp
        WHERE sp.standard_id = ?
        ORDER BY sp.step_order ASC, sp.id ASC
      `,
      values: [parentActivityId, parentActivityId, standardId],
    })) as {
      step_order: number;
      step_name: string;
      milestone_progress: number | null;
      assignment_status: string | null;
    }[];

    steps = rows.map((r) => {
      const st = String(r.assignment_status || '').toLowerCase();
      const completed = st === 'evaluated' || st === 'completed';
      return {
        stepOrder: Number(r.step_order) || 0,
        stepName: String(r.step_name || ''),
        milestoneProgress: r.milestone_progress != null ? Number(r.milestone_progress) : null,
        assignmentStatus: r.assignment_status,
        completed,
      };
    });
  } catch {
    steps = [];
  }

  const milestoneProgress = await computeMilestoneProgressForStrategicActivity(parentActivityId);
  return {
    parentProgress: milestoneProgress ?? (parent[0]?.progress != null ? Number(parent[0].progress) : null),
    steps,
  };
}
