import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import {
  computeMilestoneProgressForStrategicActivity,
  getMilestoneStepsForParentActivity,
  type MilestoneStepStatus,
} from '@/lib/milestone-progress';

const MAIN_ACTIVITY_FILTER = `
  sa.parent_id IS NULL
  AND COALESCE(TRIM(sa.source), '') <> ''
`;

export type AmbassadorMilestoneRow = {
  id: number;
  title: string;
  department: string;
  progress: number;
  pendingSteps: number;
  totalSteps: number;
  completedSteps: number;
  steps: MilestoneStepStatus[];
};

export async function listManagedUnitMilestoneActivities(
  managedUnitId: number
): Promise<AmbassadorMilestoneRow[]> {
  const scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (scopedDepartmentIds.length === 0) return [];

  const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

  const activities = (await query({
    query: `
      SELECT
        sa.id,
        sa.title,
        sa.standard_id,
        COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department
      FROM strategic_activities sa
      JOIN departments d ON d.id = sa.department_id
      WHERE sa.department_id IN (${deptPlaceholders})
        AND ${MAIN_ACTIVITY_FILTER}
        AND sa.standard_id IS NOT NULL
      ORDER BY department ASC, sa.title ASC
    `,
    values: scopedDepartmentIds,
  })) as { id: number; title: string; standard_id: number | null; department: string }[];

  const rows: AmbassadorMilestoneRow[] = [];

  for (const act of activities) {
    const { steps, parentProgress } = await getMilestoneStepsForParentActivity(act.id);
    if (steps.length === 0) continue;

    const milestoneProgress =
      parentProgress ?? (await computeMilestoneProgressForStrategicActivity(act.id)) ?? 0;
    const completedSteps = steps.filter((s) => s.completed).length;
    const pendingSteps = steps.filter((s) => !s.completed).length;

    rows.push({
      id: act.id,
      title: act.title,
      department: act.department || '—',
      progress: milestoneProgress,
      pendingSteps,
      totalSteps: steps.length,
      completedSteps,
      steps,
    });
  }

  return rows;
}
