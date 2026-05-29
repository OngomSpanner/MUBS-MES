import { query } from '@/lib/db';

export type FacultyStaffOption = {
  id: number;
  fullName: string;
  department: string;
};

/** Staff linked to departments under the ambassador's managed faculty/office unit. */
export async function listFacultyStaff(managedUnitId: number, managedUnitName: string): Promise<FacultyStaffOption[]> {
  const rows = (await query({
    query: `
      SELECT u.id,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS full_name,
             COALESCE(d.name, '') AS department
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND (
          d.parent_id = ?
          OR (TRIM(COALESCE(u.faculty_office, '')) <> '' AND LOWER(TRIM(u.faculty_office)) = LOWER(?))
        )
      ORDER BY u.surname ASC, u.first_name ASC
    `,
    values: [managedUnitId, managedUnitName],
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
  managedUnitName: string
): Promise<boolean> {
  const rows = (await query({
    query: `
      SELECT u.id
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = ?
        AND u.hrms_staff_id IS NOT NULL
        AND (
          d.parent_id = ?
          OR (TRIM(COALESCE(u.faculty_office, '')) <> '' AND LOWER(TRIM(u.faculty_office)) = LOWER(?))
        )
      LIMIT 1
    `,
    values: [userId, managedUnitId, managedUnitName],
  })) as { id: number }[];
  return rows.length > 0;
}
