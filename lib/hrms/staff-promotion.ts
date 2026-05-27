import { query } from '@/lib/db';
import {
  getRollingReportFyWindow,
  labelsFromFyWindow,
  type FinancialYearWindowEntry,
} from '@/lib/financial-year';
import { normalizePositionLabel, POSITION_NOT_SPECIFIED } from '@/lib/hrms/staff-establishment';

export type { GenderCounts } from '@/lib/hrms/staff-establishment';
import type { GenderCounts } from '@/lib/hrms/staff-establishment';

export type PromotionTableRow = {
  designation: string;
  byYear: Record<string, GenderCounts>;
};

export type StaffPromotionReport = {
  facultyName: string;
  departmentName: string;
  /** Staff with at least one promotion in the rolling FY window (after filters) */
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  rows: PromotionTableRow[];
  totals: Record<string, GenderCounts>;
  source: 'synced';
  syncedStaffCount: number;
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
  };
};

export type PromotionPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

type NormalizedStaff = {
  designation: string;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  isPwd: boolean;
  faculty: string;
  department: string;
  promotionYears: Set<string>;
};

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

function emptyCounts(): GenderCounts {
  return { male: 0, female: 0, pwd: 0 };
}

function emptyCountsByYear(yearKeys: string[]): Record<string, GenderCounts> {
  return Object.fromEntries(yearKeys.map((k) => [k, emptyCounts()]));
}

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

/**
 * Promotion in FY: current appointment date falls in the FY and is after first appointment.
 * Uses HR-synced dates on users (date_current_appointment / date_first_appointment).
 */
export function promotedInFinancialYear(
  dateFirst: string | null,
  dateCurrent: string | null,
  fy: FinancialYearWindowEntry
): boolean {
  if (!dateCurrent) return false;
  const current = dateCurrent.slice(0, 10);
  if (current < fy.start || current > fy.end) return false;
  if (!dateFirst) return false;
  const first = dateFirst.slice(0, 10);
  return current > first;
}

function promotionYearsForStaff(
  dateFirst: string | null,
  dateCurrent: string | null,
  window: FinancialYearWindowEntry[]
): Set<string> {
  const years = new Set<string>();
  for (const fy of window) {
    if (promotedInFinancialYear(dateFirst, dateCurrent, fy)) years.add(fy.key);
  }
  return years;
}

type DbStaffRow = {
  designation_grade: string | null;
  position: string | null;
  gender: string | null;
  disability_status: string | null;
  faculty_office: string | null;
  department: string | null;
  date_first_appointment: string | null;
  date_current_appointment: string | null;
  employment_status: string | null;
};

async function loadAllSyncedStaffForFilters(): Promise<NormalizedStaff[]> {
  const rows = (await query({
    query: `
      SELECT
        u.designation_grade,
        u.position,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
        DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as DbStaffRow[];

  return rows
    .map((r) => {
      if (isSeparatedEmployment(r.employment_status)) return null;
      const psn = r.designation_grade || r.position;
      const disabilityStatus = r.disability_status?.trim() || null;
      return {
        designation: normalizePositionLabel(psn),
        gender: normalizeGender(r.gender),
        disability_status: disabilityStatus,
        isPwd: disabilityStatus === 'Yes',
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
        promotionYears: new Set<string>(),
      };
    })
    .filter((s): s is NormalizedStaff => s !== null);
}

async function loadSyncedStaffForPromotions(
  window: FinancialYearWindowEntry[]
): Promise<NormalizedStaff[]> {
  const rows = (await query({
    query: `
      SELECT
        u.designation_grade,
        u.position,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
        DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as DbStaffRow[];

  return rows
    .map((r) => {
      if (isSeparatedEmployment(r.employment_status)) return null;

      const promotionYears = promotionYearsForStaff(
        r.date_first_appointment,
        r.date_current_appointment,
        window
      );
      if (promotionYears.size === 0) return null;

      const psn = r.designation_grade || r.position;
      const disabilityStatus = r.disability_status?.trim() || null;

      return {
        designation: normalizePositionLabel(psn),
        gender: normalizeGender(r.gender),
        disability_status: disabilityStatus,
        isPwd: disabilityStatus === 'Yes',
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
        promotionYears,
      };
    })
    .filter((s): s is NormalizedStaff => s !== null);
}

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: PromotionPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesFilter(
  staff: NormalizedStaff,
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: PromotionPwdFilter
): boolean {
  if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  return true;
}

function addToCounts(target: GenderCounts, staff: NormalizedStaff) {
  if (staff.gender === 'male') target.male += 1;
  else if (staff.gender === 'female') target.female += 1;
  if (staff.isPwd) target.pwd += 1;
}

function sortDesignations(a: string, b: string): number {
  if (a === POSITION_NOT_SPECIFIED) return 1;
  if (b === POSITION_NOT_SPECIFIED) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function buildDepartmentFilterOptions(staffList: NormalizedStaff[]): {
  allDepartments: string[];
  departmentsByFaculty: Record<string, string[]>;
} {
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

export function buildPromotionReport(
  staffList: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: PromotionPwdFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  syncedStaffCount: number,
  window: FinancialYearWindowEntry[] = getRollingReportFyWindow()
): StaffPromotionReport {
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);

  const filtered = staffList.filter((s) =>
    matchesFilter(s, facultyFilter, departmentFilter, pwdFilter)
  );

  const rowByDesignation = new Map<string, PromotionTableRow>();
  const totals = emptyCountsByYear(yearKeys);

  for (const staff of filtered) {
    let row = rowByDesignation.get(staff.designation);
    if (!row) {
      row = {
        designation: staff.designation,
        byYear: emptyCountsByYear(yearKeys),
      };
      rowByDesignation.set(staff.designation, row);
    }

    for (const yearKey of staff.promotionYears) {
      if (!yearKeys.includes(yearKey)) continue;
      addToCounts(row.byYear[yearKey], staff);
      addToCounts(totals[yearKey], staff);
    }
  }

  const rows = Array.from(rowByDesignation.values())
    .filter((row) => yearKeys.some((k) => {
      const c = row.byYear[k];
      return c.male + c.female + c.pwd > 0;
    }))
    .sort((a, b) => sortDesignations(a.designation, b.designation));

  const facultyName =
    facultyFilter && facultyFilter !== 'All Faculties' ? facultyFilter : '—';
  const departmentName =
    departmentFilter && departmentFilter !== 'All Departments' ? departmentFilter : '—';

  return {
    facultyName,
    departmentName,
    numberOfStaff: filtered.length,
    yearKeys,
    years,
    rows,
    totals,
    source: 'synced',
    syncedStaffCount,
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): PromotionPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

export async function generateStaffPromotionReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
}): Promise<StaffPromotionReport> {
  const window = getRollingReportFyWindow();

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const [staffList, allForFilters] = await Promise.all([
    loadSyncedStaffForPromotions(window),
    loadAllSyncedStaffForFilters(),
  ]);

  const faculties = Array.from(new Set(allForFilters.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departmentFilterOptions = buildDepartmentFilterOptions(allForFilters);

  return buildPromotionReport(
    staffList,
    options.faculty || null,
    options.department || null,
    normalizePwdFilter(options.pwd),
    faculties,
    departmentFilterOptions,
    syncedStaffCount,
    window
  );
}
