import * as XLSX from 'xlsx';
import { query } from '@/lib/db';
import { extractActivationRolesFromRoleField, sendRoleActivationEmail } from '@/lib/activation-emails';

export type HodAssignmentRow = {
  rowNumber: number;
  email: string;
  employeeId: string;
  fullName: string;
  departmentId: number | null;
  departmentName: string;
  parentDepartmentName: string;
  roles: string;
  sendActivationEmail: boolean;
};

export type HodAssignmentResult = {
  rowNumber: number;
  email: string;
  status: 'updated' | 'skipped' | 'error';
  message: string;
};

type DepartmentRow = {
  id: number;
  name: string;
  external_name: string | null;
  parent_name: string | null;
  unit_type: string | null;
};

const ASSIGNMENT_HEADERS = [
  'Email (required)',
  'Employee ID (optional)',
  'Full name (reference)',
  'Department/Unit ID',
  'Department/Unit name',
  'Parent department (optional)',
  'Roles',
  'Send activation email (Y/N)',
] as const;

const EXAMPLE_ROWS: string[][] = [
  [
    'hod.example@mubs.ac.ug',
    'EMP001',
    'Jane Doe',
    '12',
    'Department of Accounting',
    'FACULTY OF COMMERCE',
    'hod,staff',
    'Y',
  ],
  [
    'unithead.example@mubs.ac.ug',
    '',
    'John Smith',
    '',
    'DEAN OF STUDENTS\' OFFICE',
    '',
    '',
    'N',
  ],
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\*/g, '');
}

function cellString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function parseYesNo(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'y' || v === 'yes' || v === 'true' || v === '1';
}

/** NULL / blank in spreadsheets means a root-level unit (no parent faculty). */
function normalizeParentDepartment(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === 'null' || v === 'n/a' || v === 'none' || v === '-') return null;
  return v;
}

function departmentNameCandidates(dept: DepartmentRow): string[] {
  return [dept.name, dept.external_name]
    .filter(Boolean)
    .map((n) => String(n).trim().toLowerCase());
}

function departmentParentNorm(dept: DepartmentRow): string | null {
  const parent = dept.parent_name?.trim();
  return parent ? parent.toLowerCase() : null;
}

function normalizeRoleToken(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    system_administrator: 'system_admin',
    strategy_manager: 'strategy_manager',
    department_head: 'hod',
    unit_head: 'hod',
    hod: 'hod',
    head_of_department: 'hod',
    staff: 'staff',
    ambassador: 'ambassador',
    viewer: 'viewer',
    principal: 'principal',
    committee_member: 'committee_member',
  };
  return map[lower] || lower;
}

function mergeRoles(existingRoleField: string, requestedRoles: string): string {
  if (requestedRoles.trim()) {
    const tokens = requestedRoles
      .split(',')
      .map((r) => normalizeRoleToken(r))
      .filter(Boolean);
    return Array.from(new Set(tokens)).join(',');
  }

  const existing = existingRoleField
    .split(',')
    .map((r) => normalizeRoleToken(r))
    .filter(Boolean);
  if (!existing.includes('hod')) existing.push('hod');
  return Array.from(new Set(existing)).join(',');
}

export async function fetchDepartmentsForTemplate(): Promise<DepartmentRow[]> {
  const rows = (await query({
    query: `
      SELECT d.id, d.name, d.external_name, d.unit_type, p.name AS parent_name
      FROM departments d
      LEFT JOIN departments p ON d.parent_id = p.id
      WHERE d.is_active = 1
      ORDER BY d.parent_id IS NULL DESC, d.name ASC
    `,
    values: [],
  })) as DepartmentRow[];

  return rows;
}

export function buildHodAssignmentWorkbook(departments: DepartmentRow[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const instructions = [
    ['HOD / Unit Head bulk assignment template'],
    [''],
    ['Fill in the Assignments sheet, then upload it from User & Role Mgmt → Bulk HOD assignment.'],
    [''],
    ['Column rules'],
    ['Email (required)', 'MUBS email of an existing user account.'],
    ['Employee ID (optional)', 'Alternative lookup if email is wrong; email takes priority.'],
    ['Full name (reference)', 'For your records only; not used to match users.'],
    ['Department/Unit ID', 'Numeric ID from the Departments sheet. Use this OR department name.'],
    ['Department/Unit name', 'Exact name from Departments sheet if ID is blank.'],
    ['Parent department (optional)', 'Faculty/parent name when the same department name exists under multiple units. Use NULL or leave blank for root-level units.'],
    ['Roles', 'Leave blank to add HOD to existing roles. Or set e.g. hod,staff or hod only.'],
    ['Send activation email (Y/N)', 'Y sends HOD welcome email when SMTP is configured.'],
    [''],
    ['Notes'],
    ['• HOD access is tied to Department/Unit — pick the unit they head.'],
    ['• Legacy values unit_head and department_head are treated as hod.'],
    ['• If two units share the same name, add Parent department or use Department/Unit ID.'],
    ['• Aliases accepted: user_email, department_name, parent_department, current_department.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

  const assignmentSheet = XLSX.utils.aoa_to_sheet([Array.from(ASSIGNMENT_HEADERS), ...EXAMPLE_ROWS]);
  assignmentSheet['!cols'] = [
    { wch: 32 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 42 },
    { wch: 42 },
    { wch: 16 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, assignmentSheet, 'Assignments');

  const deptRows = departments.map((d) => ({
    department_id: d.id,
    department_name: d.name,
    external_name: d.external_name ?? '',
    parent_name: d.parent_name ?? '',
    unit_type: d.unit_type ?? '',
  }));
  const deptSheet = XLSX.utils.json_to_sheet(deptRows);
  deptSheet['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 48 }, { wch: 36 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, deptSheet, 'Departments');

  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function findAssignmentsSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  const preferred = wb.Sheets.Assignments ?? wb.Sheets.assignments;
  if (preferred) return preferred;
  const firstName = wb.SheetNames[0];
  return firstName ? wb.Sheets[firstName] : null;
}

function mapRowByHeaders(headers: string[], row: unknown[]): HodAssignmentRow | null {
  const normalized = headers.map(normalizeHeader);
  const get = (...aliases: string[]) => {
    const idx = normalized.findIndex((h) => aliases.some((a) => h === a || h.startsWith(a)));
    return idx >= 0 ? cellString(row[idx]) : '';
  };

  const email = get('email', 'email (required)', 'user_email').toLowerCase();
  const employeeId = get('employee id', 'employee_id', 'employee id (optional)');
  const fullName = get('full name', 'full_name', 'full name (reference)');
  const departmentIdRaw = get('department/unit id', 'department id', 'department_id', 'department/unit id');
  const departmentName =
    get('department/unit name', 'department name', 'department_name', 'department/unit name') ||
    get('current_department', 'current department');
  const parentDepartmentName = get(
    'parent department',
    'parent_department',
    'parent department (optional)',
    'parent_department/faculty',
  );
  const roles = get('roles', 'role');
  const sendActivationEmail = parseYesNo(get('send activation email', 'send_activation_email', 'send activation email (y/n)'));

  const allBlank =
    !email && !employeeId && !departmentIdRaw && !departmentName && !parentDepartmentName && !roles;
  if (allBlank) return null;

  const departmentId =
    departmentIdRaw && Number.isFinite(Number(departmentIdRaw)) ? Number(departmentIdRaw) : null;

  return {
    rowNumber: 0,
    email,
    employeeId,
    fullName,
    departmentId,
    departmentName,
    parentDepartmentName,
    roles,
    sendActivationEmail,
  };
}

export function parseHodAssignmentWorkbook(buffer: Buffer): HodAssignmentRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = findAssignmentsSheet(wb);
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  const headers = (rows[0] ?? []).map((h) => cellString(h));
  const parsed: HodAssignmentRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const mapped = mapRowByHeaders(headers, row);
    if (!mapped) continue;
    parsed.push({ ...mapped, rowNumber: i + 1 });
  }

  return parsed;
}

async function resolveDepartmentId(
  departmentId: number | null,
  departmentName: string,
  parentDepartmentName: string,
  departments: DepartmentRow[],
): Promise<{ id: number | null; error?: string }> {
  if (departmentId != null && Number.isFinite(departmentId)) {
    const found = departments.find((d) => d.id === departmentId);
    if (!found) return { id: null, error: `Department/Unit ID ${departmentId} not found` };
    return { id: departmentId };
  }

  const nameNorm = departmentName.trim().toLowerCase();
  if (!nameNorm) return { id: null, error: 'Department/Unit ID or name is required' };

  const matches = departments.filter((d) => departmentNameCandidates(d).includes(nameNorm));

  if (matches.length === 0) {
    return { id: null, error: `Department/Unit "${departmentName}" not found` };
  }

  if (matches.length === 1) {
    return { id: matches[0].id };
  }

  const parentNorm = normalizeParentDepartment(parentDepartmentName);
  if (parentNorm !== null || parentDepartmentName.trim() !== '') {
    const parentFiltered = matches.filter((d) => {
      const deptParent = departmentParentNorm(d);
      if (parentNorm === null) return deptParent === null;
      return deptParent === parentNorm;
    });

    if (parentFiltered.length === 1) {
      return { id: parentFiltered[0].id };
    }

    if (parentFiltered.length === 0) {
      const options = matches
        .map((d) => {
          const label = d.external_name?.trim() || d.name;
          const parent = d.parent_name ? ` (under ${d.parent_name})` : ' (root unit)';
          return `${label}${parent} [id ${d.id}]`;
        })
        .join('; ');
      return {
        id: null,
        error: `Department/Unit "${departmentName}" with parent "${parentDepartmentName}" not found. Options: ${options}`,
      };
    }

    const options = parentFiltered.map((d) => `[id ${d.id}]`).join(', ');
    return {
      id: null,
      error: `Department/Unit "${departmentName}" still ambiguous under "${parentDepartmentName}" — use Department/Unit ID (${options})`,
    };
  }

  const options = matches
    .map((d) => {
      const label = d.external_name?.trim() || d.name;
      const parent = d.parent_name ? ` under ${d.parent_name}` : ' (root)';
      return `${label}${parent} [id ${d.id}]`;
    })
    .join('; ');
  return {
    id: null,
    error: `Department/Unit "${departmentName}" matches multiple records — add Parent department or use Department/Unit ID. Options: ${options}`,
  };
}

async function findUserByEmailOrEmployeeId(email: string, employeeId: string) {
  if (email) {
    const rows = (await query({
      query: 'SELECT id, full_name, email, role, department_id FROM users WHERE LOWER(email) = ? LIMIT 1',
      values: [email.toLowerCase()],
    })) as { id: number; full_name: string; email: string; role: string; department_id: number | null }[];
    if (rows.length) return rows[0];
  }

  if (employeeId) {
    const rows = (await query({
      query: 'SELECT id, full_name, email, role, department_id FROM users WHERE employee_id = ? LIMIT 1',
      values: [employeeId],
    })) as { id: number; full_name: string; email: string; role: string; department_id: number | null }[];
    if (rows.length) return rows[0];
  }

  return null;
}

async function syncUserRoles(userId: number, roleStr: string) {
  const roleList = roleStr
    .split(',')
    .map((r) => normalizeRoleToken(r))
    .filter(Boolean);
  const unique = Array.from(new Set(roleList));

  await query({ query: 'DELETE FROM user_roles WHERE user_id = ?', values: [userId] });
  for (const r of unique) {
    await query({ query: 'INSERT INTO user_roles (user_id, role) VALUES (?, ?)', values: [userId, r] });
  }
}

export async function applyHodAssignmentRows(rows: HodAssignmentRow[]): Promise<HodAssignmentResult[]> {
  const departments = await fetchDepartmentsForTemplate();
  const results: HodAssignmentResult[] = [];

  for (const row of rows) {
    const label = row.email || row.employeeId || `row ${row.rowNumber}`;

    if (!row.email && !row.employeeId) {
      results.push({
        rowNumber: row.rowNumber,
        email: label,
        status: 'error',
        message: 'Email or Employee ID is required',
      });
      continue;
    }

    try {
      const user = await findUserByEmailOrEmployeeId(row.email, row.employeeId);
      if (!user) {
        results.push({
          rowNumber: row.rowNumber,
          email: row.email || row.employeeId,
          status: 'error',
          message: 'User not found',
        });
        continue;
      }

      const dept = await resolveDepartmentId(
        row.departmentId,
        row.departmentName,
        row.parentDepartmentName,
        departments,
      );
      if (!dept.id) {
        results.push({
          rowNumber: row.rowNumber,
          email: user.email,
          status: 'error',
          message: dept.error || 'Invalid department',
        });
        continue;
      }

      const nextRole = mergeRoles(user.role || '', row.roles);
      if (!nextRole.split(',').map((r) => r.trim()).filter(Boolean).includes('hod')) {
        results.push({
          rowNumber: row.rowNumber,
          email: user.email,
          status: 'error',
          message: 'Roles must include hod (leave Roles blank to add HOD automatically)',
        });
        continue;
      }

      await query({
        query: 'UPDATE users SET role = ?, department_id = ? WHERE id = ?',
        values: [nextRole, dept.id, user.id],
      });
      await syncUserRoles(user.id, nextRole);

      if (row.sendActivationEmail) {
        const deptRow = departments.find((d) => d.id === dept.id);
        const deptLabel = deptRow?.external_name?.trim() || deptRow?.name || row.departmentName;
        const rolesToNotify = extractActivationRolesFromRoleField(nextRole);
        if (rolesToNotify.includes('HOD')) {
          await sendRoleActivationEmail({
            to: user.email,
            fullName: user.full_name,
            role: 'HOD',
            departmentUnit: deptLabel,
          });
        }
      }

      results.push({
        rowNumber: row.rowNumber,
        email: user.email,
        status: 'updated',
        message: `Assigned HOD for ${deptLabelFromId(departments, dept.id)}`,
      });
    } catch (e) {
      results.push({
        rowNumber: row.rowNumber,
        email: row.email || row.employeeId,
        status: 'error',
        message: e instanceof Error ? e.message : 'Update failed',
      });
    }
  }

  return results;
}

function deptLabelFromId(departments: DepartmentRow[], id: number): string {
  const d = departments.find((x) => x.id === id);
  if (!d) return `department #${id}`;
  return d.external_name?.trim() || d.name;
}
