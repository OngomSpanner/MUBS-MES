import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';

export type FacultyStaffOption = {
  id: number;
  fullName: string;
  department: string;
};

/** Staff in the ambassador's assigned department/unit tree. */
export async function listFacultyStaff(
  managedUnitId: number,
  _managedUnitName?: string
): Promise<FacultyStaffOption[]> {
  const departmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (departmentIds.length === 0) return [];

  const placeholders = inPlaceholders(departmentIds.length);

  const rows = (await query({
    query: `
      SELECT u.id,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS full_name,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND u.department_id IN (${placeholders})
      ORDER BY u.surname ASC, u.first_name ASC
    `,
    values: departmentIds,
  })) as { id: number; full_name: string; department: string }[];

  return rows.map((r) => ({
    id: r.id,
    fullName: (r.full_name || '').trim() || `Staff #${r.id}`,
    department: r.department || '—',
  }));
}

export async function isStaffInFaculty(
  userId: number,
  managedUnitId: number,
  _managedUnitName?: string
): Promise<boolean> {
  const departmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (departmentIds.length === 0) return false;

  const placeholders = inPlaceholders(departmentIds.length);

  const rows = (await query({
    query: `
      SELECT u.id
      FROM users u
      WHERE u.id = ?
        AND u.hrms_staff_id IS NOT NULL
        AND u.department_id IN (${placeholders})
      LIMIT 1
    `,
    values: [userId, ...departmentIds],
  })) as { id: number }[];
  return rows.length > 0;
}
