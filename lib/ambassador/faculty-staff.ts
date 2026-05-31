import { query } from '@/lib/db';

export type FacultyStaffOption = {
  id: number;
  fullName: string;
  department: string;
};

/** Staff in the ambassador's assigned department/unit. */
export async function listFacultyStaff(managedUnitId: number, _managedUnitName?: string): Promise<FacultyStaffOption[]> {
  const rows = (await query({
    query: `
      SELECT u.id,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS full_name,
             COALESCE(d.name, '') AS department
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND u.department_id = ?
      ORDER BY u.surname ASC, u.first_name ASC
    `,
    values: [managedUnitId],
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
  const rows = (await query({
    query: `
      SELECT u.id
      FROM users u
      WHERE u.id = ?
        AND u.hrms_staff_id IS NOT NULL
        AND u.department_id = ?
      LIMIT 1
    `,
    values: [userId, managedUnitId],
  })) as { id: number }[];
  return rows.length > 0;
}
