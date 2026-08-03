import { query } from '@/lib/db';
import {
  AMBASSADOR_GROUP_ORDER,
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

/**
 * Persist ambassador groups this indicator is subscribed to.
 * Prefer an explicit list from the admin UI (group-chip intent).
 * Otherwise infer only when every unit in the group is selected.
 */
export async function refreshIndicatorAssignedGroupFlags(
  indicatorId: number,
  departmentIds: number[],
  catalog: AmbassadorDepartmentRow[],
  explicitGroups?: AmbassadorDepartmentGroup[] | null,
): Promise<void> {
  await ensureIndicatorGroupSchema();

  await query({
    query: 'DELETE FROM q_indicator_assigned_groups WHERE indicator_id = ?',
    values: [indicatorId],
  });

  const groups =
    explicitGroups != null
      ? Array.from(new Set(explicitGroups))
      : inferSubscribedAmbassadorGroups(departmentIds, catalog);

  for (const group of groups) {
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
 * Add peer ambassador units only for groups explicitly subscribed
 * (keeps full-group assignments current when the catalog grows).
 * Partial selections (one campus/centre) are left alone.
 */
export async function syncIndicatorDepartmentGroups(
  indicatorId: number,
  catalog: AmbassadorDepartmentRow[],
): Promise<boolean> {
  await ensureIndicatorGroupSchema();
  const before = await getSelectedDepartmentIds(indicatorId);
  const assignedGroups = await getAssignedGroupFlags(indicatorId);

  // Drop stale group flags left from the old "any member ⇒ whole group" behaviour.
  const pruned = new Set<AmbassadorDepartmentGroup>();
  for (const group of AMBASSADOR_GROUP_ORDER) {
    if (!assignedGroups.has(group)) continue;
    const members = catalog.filter((c) => c.ambassador_group === group).map((c) => c.id);
    if (members.length > 0 && members.every((id) => before.has(id))) {
      pruned.add(group);
    }
  }
  if (pruned.size !== assignedGroups.size) {
    await refreshIndicatorAssignedGroupFlags(indicatorId, Array.from(before), catalog, Array.from(pruned));
  }

  const expanded = expandAmbassadorGroupSelection(before, catalog, pruned);

  let changed = false;
  for (const id of expanded) {
    if (!before.has(id)) {
      await insertDepartmentAssignment(indicatorId, id);
      changed = true;
    }
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
