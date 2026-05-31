import { query } from '@/lib/db';
import {
  getRollingReportFyWindow,
  labelsFromFyWindow,
  type FinancialYearWindowEntry,
} from '@/lib/financial-year';
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABELS,
  formatEmploymentStatus,
  isEmploymentStatus,
} from '@/lib/staff-biodata';

export const POSITION_NOT_SPECIFIED = '(Not specified)';

export type GenderCounts = { male: number; female: number; pwd: number };

export type EstablishmentTableRow = {
  designation: string;
  byYear: Record<string, GenderCounts>;
};

export type StaffEstablishmentReport = {
  facultyName: string;
  departmentName: string;
  numberOfStaff: number;
  /** Oldest → newest (previous AY, then current AY) */
  yearKeys: string[];
  years: Record<string, string>;
  rows: EstablishmentTableRow[];
  totals: Record<string, GenderCounts>;
  /** Always from M&E users table (HR-synced records) */
  source: 'synced';
  syncedStaffCount: number;
  employmentStatusLabel: string;
  filterOptions: {
    faculties: string[];
    /** All department/unit names (any faculty) */
    departments: string[];
    /** Department/unit names grouped by faculty/office (HR pdept) */
    departmentsByFaculty: Record<string, string[]>;
    /** Employment status filter values (HR-synced / HR API mapped) */
    employmentStatuses: { value: string; label: string }[];
  };
};

export type EstablishmentPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

/** `in_service` = active staff excluding separated statuses (legacy default). */
export type EstablishmentEmploymentFilter =
  | 'all'
  | 'in_service'
  | (typeof EMPLOYMENT_STATUSES)[number];

type NormalizedStaff = {
  position: string;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  isPwd: boolean;
  faculty: string;
  department: string;
  years: Set<string>;
  employmentStatus: string;
};

const SEPARATED_EMPLOYMENT_STATUSES: readonly (typeof EMPLOYMENT_STATUSES)[number][] = [
  'terminated',
  'resigned',
  'retired',
  'dismissed',
  'deceased',
];

function emptyCounts(): GenderCounts {
  return { male: 0, female: 0, pwd: 0 };
}

function emptyCountsByYear(yearKeys: string[]): Record<string, GenderCounts> {
  return Object.fromEntries(yearKeys.map((k) => [k, emptyCounts()]));
}

/** HR position title as stored on synced user (designation_grade or position) */
export function normalizePositionLabel(psn: string | null | undefined): string {
  const raw = (psn || '').trim();
  return raw || POSITION_NOT_SPECIFIED;
}

function normalizeGender(sex: string | null | undefined): 'male' | 'female' | null {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return null;
}

/** Normalize DB / legacy HR text to canonical employment_status enum value. */
export function normalizeStoredEmploymentStatus(
  employmentStatus: string | null | undefined
): (typeof EMPLOYMENT_STATUSES)[number] | string {
  const s = (employmentStatus || '').trim().toLowerCase();
  if (!s) return 'active';
  if (isEmploymentStatus(s)) return s;
  if (s.includes('active')) return 'active';
  if (s.includes('sabbatical')) return 'sabbatical';
  if (s.includes('study')) return 'study_leave';
  if (s.includes('leave')) return 'on_leave';
  if (s.includes('expir')) return 'expired';
  if (s.includes('retir')) return 'retired';
  if (s.includes('resign')) return 'resigned';
  if (s.includes('termin')) return 'terminated';
  if (s.includes('dismiss')) return 'dismissed';
  if (s.includes('deceas')) return 'deceased';
  return s.replace(/\s+/g, '_');
}

function matchesEmploymentStatusFilter(
  staff: NormalizedStaff,
  filter: EstablishmentEmploymentFilter
): boolean {
  if (filter === 'all') return true;
  const norm = staff.employmentStatus;
  if (filter === 'in_service') {
    return !(SEPARATED_EMPLOYMENT_STATUSES as readonly string[]).includes(norm);
  }
  return norm === filter;
}

function employmentStatusFilterLabel(filter: EstablishmentEmploymentFilter): string {
  if (filter === 'all') return 'All employment statuses';
  if (filter === 'in_service') return 'In service (excl. retired, resigned, etc.)';
  if (isEmploymentStatus(filter)) return EMPLOYMENT_STATUS_LABELS[filter];
  return formatEmploymentStatus(filter);
}

function normalizeEmploymentFilter(value: string | null | undefined): EstablishmentEmploymentFilter {
  const v = (value || '').trim().toLowerCase();
  if (!v || v === 'in_service') return 'in_service';
  if (v === 'all') return 'all';
  if (isEmploymentStatus(v)) return v;
  const normalized = normalizeStoredEmploymentStatus(v);
  if (isEmploymentStatus(normalized)) return normalized;
  return 'in_service';
}

function buildEmploymentStatusFilterOptions(
  staffList: NormalizedStaff[]
): { value: string; label: string }[] {
  const present = new Set<string>();
  for (const s of staffList) present.add(s.employmentStatus);

  const ordered: string[] = ['all', 'in_service', ...EMPLOYMENT_STATUSES];

  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const value of ordered) {
    if (seen.has(value)) continue;
    seen.add(value);
    const label =
      value === 'all' || value === 'in_service' || isEmploymentStatus(value)
        ? employmentStatusFilterLabel(value as EstablishmentEmploymentFilter)
        : formatEmploymentStatus(value);
    options.push({ value, label });
  }

  for (const value of Array.from(present).sort()) {
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: formatEmploymentStatus(value) });
  }

  return options;
}

function employedInAcademicYear(
  appointment: string | null,
  contractEnd: string | null,
  year: FinancialYearWindowEntry
): boolean {
  if (!appointment) {
    return true;
  }
  if (appointment > year.end) return false;
  if (contractEnd && contractEnd < year.start) return false;
  return true;
}

function academicYearsForStaff(
  appointment: string | null,
  contractEnd: string | null,
  window: FinancialYearWindowEntry[]
): Set<string> {
  const years = new Set<string>();
  for (const ay of window) {
    if (employedInAcademicYear(appointment, contractEnd, ay)) years.add(ay.key);
  }
  if (years.size === 0) {
    for (const ay of window) years.add(ay.key);
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
  contract_end_date: string | null;
  employment_status: string | null;
};

/** HR-synced staff already in M&E (from HRMS sync), not live HR API */
async function loadSyncedStaffFromDatabase(
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
        DATE_FORMAT(COALESCE(u.contract_end_date, u.contract_end), '%Y-%m-%d') AS contract_end_date,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as DbStaffRow[];

  return rows.map((r) => {
    const years = academicYearsForStaff(r.date_first_appointment, r.contract_end_date, window);
    const psn = r.designation_grade || r.position;
    const disabilityStatus = r.disability_status?.trim() || null;
    const employmentStatus = normalizeStoredEmploymentStatus(r.employment_status);
    return {
      position: normalizePositionLabel(psn),
      gender: normalizeGender(r.gender),
      disability_status: disabilityStatus,
      isPwd: disabilityStatus === 'Yes',
      faculty: (r.faculty_office || '').trim(),
      department: (r.department || '').trim(),
      years,
      employmentStatus,
    };
  });
}

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: EstablishmentPwdFilter): boolean {
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
  pwdFilter: EstablishmentPwdFilter,
  employmentFilter: EstablishmentEmploymentFilter
): boolean {
  if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  if (!matchesEmploymentStatusFilter(staff, employmentFilter)) return false;
  return true;
}

function addToCounts(target: GenderCounts, staff: NormalizedStaff) {
  if (staff.gender === 'male') target.male += 1;
  else if (staff.gender === 'female') target.female += 1;
  if (staff.isPwd) target.pwd += 1;
}

function sortPositions(a: string, b: string): number {
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

export function buildEstablishmentReport(
  staffList: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: EstablishmentPwdFilter,
  employmentFilter: EstablishmentEmploymentFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  employmentStatusFilterOptions: { value: string; label: string }[],
  syncedStaffCount: number,
  window: FinancialYearWindowEntry[] = getRollingReportFyWindow()
): StaffEstablishmentReport {
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);

  const filtered = staffList.filter((s) =>
    matchesFilter(s, facultyFilter, departmentFilter, pwdFilter, employmentFilter)
  );
  const rowByPosition = new Map<string, EstablishmentTableRow>();
  const totals = emptyCountsByYear(yearKeys);

  for (const staff of filtered) {
    let row = rowByPosition.get(staff.position);
    if (!row) {
      row = {
        designation: staff.position,
        byYear: emptyCountsByYear(yearKeys),
      };
      rowByPosition.set(staff.position, row);
    }

    for (const yearKey of staff.years) {
      if (!yearKeys.includes(yearKey)) continue;
      addToCounts(row.byYear[yearKey], staff);
      addToCounts(totals[yearKey], staff);
    }
  }

  const rows = Array.from(rowByPosition.values()).sort((a, b) =>
    sortPositions(a.designation, b.designation)
  );

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
    employmentStatusLabel: employmentStatusFilterLabel(employmentFilter),
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
      employmentStatuses: employmentStatusFilterOptions,
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): EstablishmentPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

export async function generateStaffEstablishmentReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
  employment_status?: string | null;
}): Promise<StaffEstablishmentReport> {
  const employmentFilter = normalizeEmploymentFilter(options.employment_status);
  const window = getRollingReportFyWindow();

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const staffList = await loadSyncedStaffFromDatabase(window);

  const faculties = Array.from(new Set(staffList.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departmentFilterOptions = buildDepartmentFilterOptions(staffList);
  const employmentStatusFilterOptions = buildEmploymentStatusFilterOptions(staffList);

  return buildEstablishmentReport(
    staffList,
    options.faculty || null,
    options.department || null,
    normalizePwdFilter(options.pwd),
    employmentFilter,
    faculties,
    departmentFilterOptions,
    employmentStatusFilterOptions,
    syncedStaffCount,
    window
  );
}
