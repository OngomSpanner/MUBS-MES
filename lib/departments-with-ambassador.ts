import { query } from '@/lib/db';
import {
  attachAmbassadorGroup,
  isOutreachCentre,
  isRegionalCampus,
  type AmbassadorDepartmentRow,
  type AmbassadorGroupIdSets,
} from '@/lib/department-ambassador-groups';

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

function registeredName(row: DepartmentQueryRow): string {
  return row.name?.trim() || '';
}

let cachedIdSets: AmbassadorGroupIdSets | null = null;
let cachedIdSetsAt = 0;
const ID_SETS_CACHE_MS = 60_000;

/**
 * Resolve outreach/regional department ids from registered rows in departments table.
 * Server-only — do not import this module from client components.
 */
export async function buildAmbassadorGroupIdSets(forceRefresh = false): Promise<AmbassadorGroupIdSets> {
  const now = Date.now();
  if (!forceRefresh && cachedIdSets && now - cachedIdSetsAt < ID_SETS_CACHE_MS) {
    return cachedIdSets;
  }

  const rows = (await query({
    query: `SELECT id, name FROM departments WHERE is_active = 1 OR is_active IS NULL`,
    values: [],
  })) as { id: number; name: string }[];

  const outreach = new Set<number>();
  const regional = new Set<number>();

  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const id = Number(row.id);
    if (isOutreachCentre(name)) outreach.add(id);
    if (isRegionalCampus(name)) regional.add(id);
  }

  cachedIdSets = { outreach, regional };
  cachedIdSetsAt = now;
  return cachedIdSets;
}

/**
 * Departments that have at least one user with the Ambassador role assigned via managed_unit_id.
 * Grouping uses departments.id + departments.name (not external_name).
 */
export async function fetchDepartmentsWithAmbassador(activeOnly = true): Promise<AmbassadorDepartmentRow[]> {
  const activeClause = activeOnly ? ' AND (d.is_active = 1 OR d.is_active IS NULL)' : '';
  const idSets = await buildAmbassadorGroupIdSets();

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
    attachAmbassadorGroup(
      {
        id: Number(row.id),
        name: displayName(row),
        registered_name: registeredName(row),
        parent_id: row.parent_id != null ? Number(row.parent_id) : null,
        unit_type: row.unit_type || 'department',
      },
      idSets,
    ),
  );
}
