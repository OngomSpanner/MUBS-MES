import { query } from '@/lib/db';
import {
  type AmbassadorDepartmentGroup,
  type AmbassadorDepartmentRow,
} from '@/lib/department-ambassador-groups';
import { expandAmbassadorGroupSelection, inferSubscribedAmbassadorGroups } from '@/lib/expand-ambassador-group-selection';
import { fetchDepartmentsWithAmbassador } from '@/lib/departments-with-ambassador';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

async function ensureIndicatorGroupSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await query({
        query: `
          CREATE TABLE IF NOT EXISTS q_indicator_assigned_groups (
            indicator_id INT NOT NULL,
            ambassador_group ENUM('outreach', 'regional', 'faculty', 'department_of') NOT NULL,
            PRIMARY KEY (indicator_id, ambassador_group),
            KEY idx_qiag_indicator (indicator_id)
          ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
        `,
      });
      schemaEnsured = true;
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

async function getSelectedDepartmentIds(indicatorId: number): Promise<Set<number>> {
  const rows = (await query({
    query: 'SELECT department_id FROM q_indicator_departments WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { department_id: number }[];
  return new Set(rows.map((r) => Number(r.department_id)));
}

/** Persist ambassador groups this indicator is subscribed to (any unit selected → full group). */
export async function refreshIndicatorAssignedGroupFlags(
  indicatorId: number,
  departmentIds: number[],
  catalog: AmbassadorDepartmentRow[],
): Promise<void> {
  await ensureIndicatorGroupSchema();

  await query({
    query: 'DELETE FROM q_indicator_assigned_groups WHERE indicator_id = ?',
    values: [indicatorId],
  });

  for (const group of inferSubscribedAmbassadorGroups(departmentIds, catalog)) {
    await query({
      query: 'INSERT INTO q_indicator_assigned_groups (indicator_id, ambassador_group) VALUES (?, ?)',
      values: [indicatorId, group],
    });
  }
}

async function getAssignedGroupFlags(indicatorId: number): Promise<Set<AmbassadorDepartmentGroup>> {
  await ensureIndicatorGroupSchema();
  const rows = (await query({
    query: 'SELECT ambassador_group FROM q_indicator_assigned_groups WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { ambassador_group: AmbassadorDepartmentGroup }[];
  return new Set(rows.map((r) => r.ambassador_group));
}

async function insertDepartmentAssignment(indicatorId: number, departmentId: number): Promise<void> {
  await query({
    query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)',
    values: [indicatorId, departmentId],
  });
}

/**
 * Add all ambassador units for any group that already has at least one assigned unit,
 * and keep groups up to date when the ambassador catalog grows.
 */
export async function syncIndicatorDepartmentGroups(
  indicatorId: number,
  catalog: AmbassadorDepartmentRow[],
): Promise<boolean> {
  await ensureIndicatorGroupSchema();
  const assignedGroups = await getAssignedGroupFlags(indicatorId);
  const before = await getSelectedDepartmentIds(indicatorId);
  const expanded = expandAmbassadorGroupSelection(before, catalog, assignedGroups);

  let changed = false;
  for (const id of expanded) {
    if (!before.has(id)) {
      await insertDepartmentAssignment(indicatorId, id);
      changed = true;
    }
  }

  if (changed) {
    await refreshIndicatorAssignedGroupFlags(indicatorId, expanded, catalog);
  }

  return changed;
}

export async function getIndicatorAssignedGroups(
  indicatorId: number,
): Promise<AmbassadorDepartmentGroup[]> {
  const flags = await getAssignedGroupFlags(indicatorId);
  return Array.from(flags);
}

/** After a new ambassador is assigned to a unit, update all indicators that subscribe to that group. */
export async function syncAllIndicatorsForAmbassadorCatalog(): Promise<void> {
  const catalog = await fetchDepartmentsWithAmbassador(true);
  const rows = (await query({
    query: 'SELECT id FROM q_indicators',
  })) as { id: number }[];

  for (const row of rows) {
    await syncIndicatorDepartmentGroups(Number(row.id), catalog);
  }
}

export async function syncIndicatorDepartmentGroupsWithCatalog(indicatorId: number): Promise<boolean> {
  const catalog = await fetchDepartmentsWithAmbassador(true);
  return syncIndicatorDepartmentGroups(indicatorId, catalog);
}

export { ensureIndicatorGroupSchema };
