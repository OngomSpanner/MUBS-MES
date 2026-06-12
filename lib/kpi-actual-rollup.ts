import { query } from '@/lib/db';

/** Sum evaluated KPI actuals from staff reports linked to a strategic activity tree. */
export async function sumKpiActualForStrategicActivity(
  strategicActivityId: number
): Promise<number | null> {
  const rows = (await query({
    query: `
      SELECT COALESCE(SUM(sr.kpi_actual_value), 0) AS total
      FROM staff_reports sr
      LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
      LEFT JOIN strategic_activities act_aa ON aa.activity_id = act_aa.id
      LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
      LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
      LEFT JOIN strategic_activities act_spa ON spa.activity_id = act_spa.id
      WHERE sr.kpi_actual_value IS NOT NULL
        AND sr.status IN ('submitted', 'evaluated')
        AND (
          act_aa.id = ? OR act_aa.parent_id = ?
          OR act_spa.id = ? OR act_spa.parent_id = ?
        )
    `,
    values: [strategicActivityId, strategicActivityId, strategicActivityId, strategicActivityId],
  })) as { total: number }[];

  const total = Number(rows[0]?.total ?? 0);
  return total > 0 ? total : null;
}

/** Persist rolled-up KPI actual on the parent strategic activity row. */
export async function rollupKpiActualForStrategicActivity(
  strategicActivityId: number
): Promise<number | null> {
  const total = await sumKpiActualForStrategicActivity(strategicActivityId);
  await query({
    query: 'UPDATE strategic_activities SET actual_value = ? WHERE id = ?',
    values: [total, strategicActivityId],
  });
  return total;
}
