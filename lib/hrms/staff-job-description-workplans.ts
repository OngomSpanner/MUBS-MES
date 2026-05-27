import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';

export type JobDescriptionWorkplansGenderFilter = 'all' | 'male' | 'female';
export type JobDescriptionWorkplansPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type StaffJobDescriptionWorkplansReport = {
  facultyName: string;
  departmentName: string;
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  byYear: Record<string, number | null>;
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

function normalizePwdFilter(value: string | null | undefined): JobDescriptionWorkplansPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function normalizeGenderFilter(value: string | null | undefined): JobDescriptionWorkplansGenderFilter {
  if (value === 'male' || value === 'female') return value;
  return 'all';
}

function matchesPwdFilter(staff: StaffRow, pwdFilter: JobDescriptionWorkplansPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesGenderFilter(staff: StaffRow, genderFilter: JobDescriptionWorkplansGenderFilter): boolean {
  if (genderFilter === 'all') return true;
  return staff.gender === genderFilter;
}

function matchesFilter(
  staff: StaffRow,
  facultyFilter: string | null,
  departmentFilter: string | null,
  genderFilter: JobDescriptionWorkplansGenderFilter,
  pwdFilter: JobDescriptionWorkplansPwdFilter
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

async function loadManualPct(yearKeys: string[]): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = Object.fromEntries(yearKeys.map((k) => [k, null]));
  if (yearKeys.length === 0) return result;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT financial_year_key, pct
        FROM staff_job_description_workplans_pct
        WHERE financial_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as { financial_year_key: string; pct: number | null }[];

    for (const r of rows) {
      result[r.financial_year_key] = r.pct != null ? Number(r.pct) : null;
    }
  } catch {
    // table may not exist
  }
  return result;
}

async function loadUpdatedIdsByYear(yearKeys: string[]): Promise<Record<string, number[]>> {
  const result: Record<string, number[]> = Object.fromEntries(yearKeys.map((k) => [k, [] as number[]]));
  if (yearKeys.length === 0) return result;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT user_id, financial_year_key
        FROM staff_job_description_workplans_entries
        WHERE financial_year_key IN (${placeholders})
          AND has_updated = 1
      `,
      values: yearKeys,
    })) as { user_id: number; financial_year_key: string }[];

    for (const r of rows) {
      if (!result[r.financial_year_key]) result[r.financial_year_key] = [];
      result[r.financial_year_key].push(r.user_id);
    }
  } catch {
    // table may not exist
  }

  return result;
}

export async function generateStaffJobDescriptionWorkplansReport(options: {
  faculty?: string | null;
  department?: string | null;
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffJobDescriptionWorkplansReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);
  const genderFilter = normalizeGenderFilter(options.gender);
  const pwdFilter = normalizePwdFilter(options.pwd);

  const [filterRows, allStaff, updatedIdsByYear, manualPct] = await Promise.all([
    loadFilterOptions(),
    loadAllActiveStaff(),
    loadUpdatedIdsByYear(yearKeys),
    loadManualPct(yearKeys),
  ]);

  const staffInScope = allStaff.filter((s) =>
    matchesFilter(s, options.faculty || null, options.department || null, genderFilter, pwdFilter)
  );
  const staffIds = new Set(staffInScope.map((s) => s.userId));
  const totalInScope = staffInScope.length;

  const byYear: Record<string, number | null> = {};
  for (const key of yearKeys) {
    const updatedCount = (updatedIdsByYear[key] ?? []).filter((id) => staffIds.has(id)).length;
    if (updatedCount > 0 || totalInScope > 0) {
      byYear[key] = pct(updatedCount, totalInScope);
    } else {
      byYear[key] = manualPct[key] ?? null;
    }
  }

  const deptOptions = buildDepartmentFilterOptions(filterRows);
  const faculties = Array.from(new Set(filterRows.map((s) => s.faculty).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const facultyName = options.faculty && options.faculty !== 'All Faculties' ? options.faculty : '—';
  const departmentName = options.department && options.department !== 'All Departments' ? options.department : '—';

  return {
    facultyName,
    departmentName,
    numberOfStaff: totalInScope,
    yearKeys,
    years,
    byYear,
    filterOptions: {
      faculties: ['All Faculties', ...faculties],
      departments: ['All Departments', ...deptOptions.allDepartments],
      departmentsByFaculty: deptOptions.departmentsByFaculty,
    },
  };
}

