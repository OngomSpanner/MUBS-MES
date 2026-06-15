import { query } from '@/lib/db';

let ensured = false;

export async function ensureStandardDepartmentsTable(): Promise<void> {
  if (ensured) return;
  await query({
    query: `
      CREATE TABLE IF NOT EXISTS standard_departments (
        standard_id INT NOT NULL,
        department_id INT NOT NULL,
        PRIMARY KEY (standard_id, department_id),
        KEY idx_standard_departments_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });
  ensured = true;
}

export type StandardDepartmentRow = {
  standard_id: number;
  department_id: number;
  department_name: string;
};

export async function loadStandardDepartmentRows(): Promise<StandardDepartmentRow[]> {
  await ensureStandardDepartmentsTable();
  return (await query({
    query: `
      SELECT
        sd.standard_id,
        sd.department_id,
        COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM standard_departments sd
      JOIN departments d ON d.id = sd.department_id
      ORDER BY sd.standard_id ASC, department_name ASC
    `,
  })) as StandardDepartmentRow[];
}

export function groupStandardDepartments(rows: StandardDepartmentRow[]): Map<
  number,
  { department_ids: number[]; department_names: string[] }
> {
  const map = new Map<number, { department_ids: number[]; department_names: string[] }>();
  for (const row of rows) {
    const sid = Number(row.standard_id);
    if (!map.has(sid)) map.set(sid, { department_ids: [], department_names: [] });
    const entry = map.get(sid)!;
    entry.department_ids.push(Number(row.department_id));
    entry.department_names.push(String(row.department_name || '').trim() || `Unit #${row.department_id}`);
  }
  return map;
}

export async function getDepartmentIdsForStandard(standardId: number): Promise<number[]> {
  await ensureStandardDepartmentsTable();
  const rows = (await query({
    query: 'SELECT department_id FROM standard_departments WHERE standard_id = ? ORDER BY department_id ASC',
    values: [standardId],
  })) as { department_id: number }[];
  return rows.map((r) => Number(r.department_id));
}

export async function setStandardDepartments(standardId: number, departmentIds: number[]): Promise<void> {
  await ensureStandardDepartmentsTable();
  const uniqueIds = Array.from(
    new Set(departmentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
  );
  await query({
    query: 'DELETE FROM standard_departments WHERE standard_id = ?',
    values: [standardId],
  });
  for (const departmentId of uniqueIds) {
    await query({
      query: 'INSERT INTO standard_departments (standard_id, department_id) VALUES (?, ?)',
      values: [standardId, departmentId],
    });
  }
}

export function parseDepartmentIdsPayload(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((v) => Number(v))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
}
