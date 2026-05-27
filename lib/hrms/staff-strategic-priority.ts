import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';
import { PILLAR_LABELS, STRATEGIC_PILLARS_2025_2030, type StrategicPillar } from '@/lib/strategic-plan';

export type StrategicPriorityPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';
export type StrategicPriorityGenderFilter = 'all' | 'male' | 'female';

export type StrategicPriorityRow = {
  pillar: StrategicPillar;
  pillarLabel: string;
  byYear: Record<string, number | null>;
};

export type StaffStrategicPriorityReport = {
  facultyName: string;
  departmentName: string;
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  rows: StrategicPriorityRow[];
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
  };
};

type StaffRow = {
  userId: number;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  faculty: string;
  department: string;
};

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

function normalizeGender(sex: string | null | undefined): 'male' | 'female' | null {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return null;
}

function isSeparatedEmployment(employmentStatus: string | null | undefined): boolean {
  const emp = (employmentStatus || '').toLowerCase();
  return SEPARATED_EMPLOYMENT.some((x) => emp.includes(x));
}

function normalizePwdFilter(value: string | null | undefined): StrategicPriorityPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function normalizeGenderFilter(value: string | null | undefined): StrategicPriorityGenderFilter {
  if (value === 'male' || value === 'female') return value;
  return 'all';
}

function matchesPwdFilter(staff: StaffRow, pwdFilter: StrategicPriorityPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesGenderFilter(staff: StaffRow, genderFilter: StrategicPriorityGenderFilter): boolean {
  if (genderFilter === 'all') return true;
  return staff.gender === genderFilter;
}

function matchesFilter(
  staff: StaffRow,
  facultyFilter: string | null,
  departmentFilter: string | null,
  genderFilter: StrategicPriorityGenderFilter,
  pwdFilter: StrategicPriorityPwdFilter
): boolean {
  if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesGenderFilter(staff, genderFilter)) return false;
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  return true;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function computeStaffPct(assignedCount: number, totalInScope: number): number | null {
  if (assignedCount === 0 && totalInScope <= 0) return null;
  return pct(assignedCount, totalInScope);
}

function mapStaffRows(
  rows: {
    user_id: number;
    gender: string | null;
    disability_status: string | null;
    faculty_office: string | null;
    department: string | null;
    employment_status: string | null;
  }[]
): StaffRow[] {
  return rows
    .filter((r) => !isSeparatedEmployment(r.employment_status))
    .map((r) => ({
      userId: r.user_id,
      gender: normalizeGender(r.gender),
      disability_status: r.disability_status?.trim() || null,
      faculty: (r.faculty_office || '').trim(),
      department: (r.department || '').trim(),
    }));
}

async function loadManualPct(yearKeys: string[]): Promise<Map<string, Record<string, number | null>>> {
  const result = new Map<string, Record<string, number | null>>();
  for (const pillar of STRATEGIC_PILLARS_2025_2030) {
    result.set(pillar, Object.fromEntries(yearKeys.map((k) => [k, null])));
  }
  if (yearKeys.length === 0) return result;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT strategic_pillar, financial_year_key, gender_pct
        FROM staff_strategic_priority_pct
        WHERE financial_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as {
      strategic_pillar: string;
      financial_year_key: string;
      gender_pct: number | null;
    }[];

    for (const r of rows) {
      const pillar = r.strategic_pillar as StrategicPillar;
      if (!result.has(pillar)) continue;
      result.get(pillar)![r.financial_year_key] =
        r.gender_pct != null ? Number(r.gender_pct) : null;
    }
  } catch {
    // table may not exist
  }
  return result;
}

async function loadAssignments(
  yearKeys: string[]
): Promise<Map<string, Record<string, number[]>>> {
  const byPillarYear = new Map<string, Record<string, number[]>>();
  for (const pillar of STRATEGIC_PILLARS_2025_2030) {
    byPillarYear.set(pillar, Object.fromEntries(yearKeys.map((k) => [k, [] as number[]])));
  }
  if (yearKeys.length === 0) return byPillarYear;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT user_id, strategic_pillar, financial_year_key
        FROM staff_strategic_priority_assignments
        WHERE financial_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as { user_id: number; strategic_pillar: string; financial_year_key: string }[];

    for (const r of rows) {
      const pillar = r.strategic_pillar as StrategicPillar;
      const yearMap = byPillarYear.get(pillar);
      if (!yearMap) continue;
      if (!yearMap[r.financial_year_key]) yearMap[r.financial_year_key] = [];
      yearMap[r.financial_year_key].push(r.user_id);
    }
  } catch {
    // table may not exist
  }
  return byPillarYear;
}

async function loadAllActiveStaff(): Promise<StaffRow[]> {
  const rows = (await query({
    query: `
      SELECT
        u.id AS user_id,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as {
    user_id: number;
    gender: string | null;
    disability_status: string | null;
    faculty_office: string | null;
    department: string | null;
    employment_status: string | null;
  }[];

  return mapStaffRows(rows);
}

async function loadFilterOptions(): Promise<{ faculty: string; department: string }[]> {
  const rows = (await query({
    query: `
      SELECT u.faculty_office, COALESCE(d.name, '') AS department
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as { faculty_office: string | null; department: string }[];

  return rows.map((r) => ({
    faculty: (r.faculty_office || '').trim(),
    department: (r.department || '').trim(),
  }));
}

function buildDepartmentFilterOptions(staffList: { faculty: string; department: string }[]) {
  const all = new Set<string>();
  const byFaculty = new Map<string, Set<string>>();

  for (const s of staffList) {
    if (s.department) all.add(s.department);
    if (!s.faculty || !s.department) continue;
    if (!byFaculty.has(s.faculty)) byFaculty.set(s.faculty, new Set());
    byFaculty.get(s.faculty)!.add(s.department);
  }

  const departmentsByFaculty: Record<string, string[]> = {};
  for (const [faculty, depts] of byFaculty) {
    departmentsByFaculty[faculty] = Array.from(depts).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }

  return {
    allDepartments: Array.from(all).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    departmentsByFaculty,
  };
}

export async function generateStaffStrategicPriorityReport(options: {
  faculty?: string | null;
  department?: string | null;
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffStrategicPriorityReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);
  const genderFilter = normalizeGenderFilter(options.gender);
  const pwdFilter = normalizePwdFilter(options.pwd);

  const [assignments, manualPct, filterRows, allStaff] = await Promise.all([
    loadAssignments(yearKeys),
    loadManualPct(yearKeys),
    loadFilterOptions(),
    loadAllActiveStaff(),
  ]);

  const staffInScope = allStaff.filter((s) =>
    matchesFilter(s, options.faculty || null, options.department || null, genderFilter, pwdFilter)
  );
  const staffById = new Map(staffInScope.map((s) => [s.userId, s]));
  const totalInScope = staffInScope.length;

  const rows: StrategicPriorityRow[] = STRATEGIC_PILLARS_2025_2030.map((pillar) => {
    const byYear: Record<string, number | null> = {};

    for (const key of yearKeys) {
      const assignedCount = (assignments.get(pillar)?.[key] ?? []).filter((id) =>
        staffById.has(id)
      ).length;

      if (assignedCount > 0 || totalInScope > 0) {
        byYear[key] = computeStaffPct(assignedCount, totalInScope);
      } else {
        byYear[key] = manualPct.get(pillar)?.[key] ?? null;
      }
    }

    return {
      pillar,
      pillarLabel: PILLAR_LABELS[pillar] ?? pillar,
      byYear,
    };
  });

  const deptOptions = buildDepartmentFilterOptions(filterRows);
  const faculties = Array.from(new Set(filterRows.map((s) => s.faculty).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const facultyName =
    options.faculty && options.faculty !== 'All Faculties' ? options.faculty : '—';
  const departmentName =
    options.department && options.department !== 'All Departments' ? options.department : '—';

  return {
    facultyName,
    departmentName,
    numberOfStaff: totalInScope,
    yearKeys,
    years,
    rows,
    filterOptions: {
      faculties: ['All Faculties', ...faculties],
      departments: ['All Departments', ...deptOptions.allDepartments],
      departmentsByFaculty: deptOptions.departmentsByFaculty,
    },
  };
}
