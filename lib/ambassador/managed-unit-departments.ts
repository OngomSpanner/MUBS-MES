import { query } from '@/lib/db';

/** The ambassador's assigned department/unit. */
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
      WHERE id = ? AND is_active = 1
    `,
    values: [managedUnitId],
  })) as { id: number; name: string; display_name: string }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.display_name,
  }));
}

/** Department ids the ambassador may access (their assigned unit only). */
export async function getManagedUnitDepartmentIds(managedUnitId: number): Promise<number[]> {
  const rows = (await query({
    query: `SELECT id FROM departments WHERE id = ? AND is_active = 1`,
    values: [managedUnitId],
  })) as { id: number }[];

  return rows.map((r) => r.id);
}
