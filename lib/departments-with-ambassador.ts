import { query } from '@/lib/db';
import { withAmbassadorGroup, type AmbassadorDepartmentRow } from '@/lib/department-ambassador-groups';

type DepartmentQueryRow = {
  id: number;
  name: string;
  code: string | null;
  unit_type: string;
  parent_id: number | null;
  is_active: number | null;
  external_name: string | null;
  parent_name: string | null;
};

function displayName(row: DepartmentQueryRow): string {
  const external = row.external_name?.trim();
  if (external) return external;
  return row.name?.trim() || '';
}

/**
 * Departments that have at least one user with the Ambassador role assigned via managed_unit_id.
 */
export async function fetchDepartmentsWithAmbassador(activeOnly = true): Promise<AmbassadorDepartmentRow[]> {
  const activeClause = activeOnly ? ' AND (d.is_active = 1 OR d.is_active IS NULL)' : '';

  let rows: DepartmentQueryRow[] = [];
  try {
    rows = (await query({
      query: `
        SELECT DISTINCT d.id, d.name, d.code, d.unit_type, d.parent_id, d.is_active, d.external_name,
               p.name AS parent_name
        FROM departments d
        LEFT JOIN departments p ON d.parent_id = p.id
        INNER JOIN users u ON u.managed_unit_id = d.id
        WHERE u.managed_unit_id IS NOT NULL
          AND (
            LOWER(COALESCE(u.role, '')) LIKE '%ambassador%'
            OR EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = u.id AND LOWER(ur.role) LIKE '%ambassador%'
            )
          )
          ${activeClause}
        ORDER BY d.name ASC
      `,
      values: [],
    })) as DepartmentQueryRow[];
  } catch {
    rows = (await query({
      query: `
        SELECT DISTINCT d.id, d.name, d.code, d.unit_type, d.parent_id, d.is_active, d.external_name,
               NULL AS parent_name
        FROM departments d
        INNER JOIN users u ON u.managed_unit_id = d.id
        WHERE u.managed_unit_id IS NOT NULL
          AND LOWER(COALESCE(u.role, '')) LIKE '%ambassador%'
          ${activeClause}
        ORDER BY d.name ASC
      `,
      values: [],
    })) as DepartmentQueryRow[];
  }

  return rows.map((row) =>
    withAmbassadorGroup({
      id: Number(row.id),
      name: displayName(row),
      parent_id: row.parent_id != null ? Number(row.parent_id) : null,
      unit_type: row.unit_type || 'department',
    }),
  );
}
