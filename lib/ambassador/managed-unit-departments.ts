import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';

/** The ambassador's assigned department/unit. */
export type ManagedUnitDepartment = {
  id: number;
  /** Canonical name (matches users.department / HR dept). */
  name: string;
  /** Friendlier label when office and dept share the same name. */
  displayName: string;
};

export function isDepartmentInManagedScope(departmentId: number, scopedIds: number[]): boolean {
  return scopedIds.includes(departmentId);
}

/**
 * Department ids the ambassador may access: assigned unit plus child units when
 * the managed unit is a parent office/faculty.
 */
export async function getManagedUnitDepartmentIds(managedUnitId: number): Promise<number[]> {
  const depts = (await query({
    query: `SELECT id, parent_id FROM departments WHERE id = ? AND (is_active = 1 OR is_active IS NULL)`,
    values: [managedUnitId],
  })) as { id: number; parent_id: number | null }[];

  if (!depts.length) return [];

  const parentId = depts[0].parent_id;

  // Child unit ambassador — scope to assigned unit only.
  if (parentId != null) {
    return [managedUnitId];
  }

  let children: { id: number }[] = [];
  try {
    children = (await query({
      query: 'SELECT id FROM departments WHERE parent_id = ? AND is_active = 1',
      values: [managedUnitId],
    })) as { id: number }[];
  } catch {
    children = (await query({
      query: 'SELECT id FROM departments WHERE parent_id = ?',
      values: [managedUnitId],
    })) as { id: number }[];
  }

  const childIds = children.map((r) => r.id);
  return childIds.length > 0 ? [managedUnitId, ...childIds] : [managedUnitId];
}

export async function listManagedUnitDepartments(managedUnitId: number): Promise<ManagedUnitDepartment[]> {
  const ids = await getManagedUnitDepartmentIds(managedUnitId);
  if (ids.length === 0) return [];

  const placeholders = inPlaceholders(ids.length);
  const rows = (await query({
    query: `
      SELECT
        id,
        name,
        COALESCE(NULLIF(TRIM(external_name), ''), name) AS display_name
      FROM departments
      WHERE id IN (${placeholders}) AND is_active = 1
      ORDER BY display_name ASC
    `,
    values: ids,
  })) as { id: number; name: string; display_name: string }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.display_name,
  }));
}
