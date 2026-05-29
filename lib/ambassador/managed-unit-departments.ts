import { query } from '@/lib/db';

/** Active departments and units directly under the ambassador's faculty/office. */
export type ManagedUnitDepartment = {
  id: number;
  /** Canonical name (matches users.department / HR dept). */
  name: string;
  /** Friendlier label when office and dept share the same name. */
  displayName: string;
};

export async function listManagedUnitDepartments(managedUnitId: number): Promise<ManagedUnitDepartment[]> {
  const rows = (await query({
    query: `
      SELECT
        id,
        name,
        COALESCE(NULLIF(TRIM(external_name), ''), name) AS display_name
      FROM departments
      WHERE parent_id = ? AND is_active = 1
      ORDER BY COALESCE(NULLIF(TRIM(external_name), ''), name) ASC
    `,
    values: [managedUnitId],
  })) as { id: number; name: string; display_name: string }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.display_name,
  }));
}

/** Department ids the ambassador may oversee (child departments + the faculty/office unit itself). */
export async function getManagedUnitDepartmentIds(managedUnitId: number): Promise<number[]> {
  const rows = (await query({
    query: `
      SELECT id
      FROM departments
      WHERE is_active = 1 AND (id = ? OR parent_id = ?)
    `,
    values: [managedUnitId, managedUnitId],
  })) as { id: number }[];

  return rows.map((r) => r.id);
}
