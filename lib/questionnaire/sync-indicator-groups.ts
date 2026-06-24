import { query } from '@/lib/db';
import {
  AMBASSADOR_GROUP_ORDER,
  type AmbassadorDepartmentGroup,
  type AmbassadorDepartmentRow,
} from '@/lib/department-ambassador-groups';
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
            CONSTRAINT fk_qiag_indicator FOREIGN KEY (indicator_id) REFERENCES q_indicators(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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

function groupMemberIds(
  catalog: AmbassadorDepartmentRow[],
  group: AmbassadorDepartmentGroup,
): number[] {
  return catalog.filter((c) => c.ambassador_group === group).map((c) => c.id);
}

/** Persist which groups were fully selected when the indicator was last saved. */
export async function refreshIndicatorAssignedGroupFlags(
  indicatorId: number,
  departmentIds: number[],
  catalog: AmbassadorDepartmentRow[],
): Promise<void> {
  await ensureIndicatorGroupSchema();
  const selected = new Set(departmentIds);

  await query({
    query: 'DELETE FROM q_indicator_assigned_groups WHERE indicator_id = ?',
    values: [indicatorId],
  });

  for (const group of AMBASSADOR_GROUP_ORDER) {
    const backed = groupMemberIds(catalog, group);
    if (backed.length === 0) continue;
    if (backed.every((id) => selected.has(id))) {
      await query({
        query: 'INSERT INTO q_indicator_assigned_groups (indicator_id, ambassador_group) VALUES (?, ?)',
        values: [indicatorId, group],
      });
    }
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
 * Add new ambassador units when an indicator already includes every other member of that group
 * (e.g. had all 10 faculties; 11th gets an ambassador → auto-assign 11th).
 * Also expands indicators flagged as full-group on last save.
 */
export async function syncIndicatorDepartmentGroups(
  indicatorId: number,
  catalog: AmbassadorDepartmentRow[],
): Promise<boolean> {
  await ensureIndicatorGroupSchema();
  const assignedGroups = await getAssignedGroupFlags(indicatorId);
  let selected = await getSelectedDepartmentIds(indicatorId);
  let changed = false;

  let loop = true;
  while (loop) {
    loop = false;
    for (const group of AMBASSADOR_GROUP_ORDER) {
      const backed = groupMemberIds(catalog, group);
      if (backed.length === 0) continue;

      if (assignedGroups.has(group)) {
        for (const id of backed) {
          if (!selected.has(id)) {
            await insertDepartmentAssignment(indicatorId, id);
            selected.add(id);
            changed = true;
            loop = true;
          }
        }
        continue;
      }

      for (const missingId of backed) {
        if (selected.has(missingId)) continue;
        const others = backed.filter((id) => id !== missingId);
        if (others.length > 0 && others.every((id) => selected.has(id))) {
          await insertDepartmentAssignment(indicatorId, missingId);
          selected.add(missingId);
          assignedGroups.add(group);
          await query({
            query: `INSERT IGNORE INTO q_indicator_assigned_groups (indicator_id, ambassador_group) VALUES (?, ?)`,
            values: [indicatorId, group],
          });
          changed = true;
          loop = true;
        }
      }
    }
  }

  return changed;
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
