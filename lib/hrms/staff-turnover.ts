import { query } from '@/lib/db';
import { normalizePositionLabel } from '@/lib/hrms/staff-establishment';

export type TurnoverCategory = 'retired' | 'resigned' | 'terminated_dismissed' | 'death';

export const TURNOVER_CATEGORY_LABELS: Record<TurnoverCategory, string> = {
  retired: 'Retired',
  resigned: 'Resigned',
  terminated_dismissed: 'Terminated/Dismissed',
  death: 'Death',
};

export const TURNOVER_CATEGORY_ORDER: TurnoverCategory[] = [
  'retired',
  'resigned',
  'terminated_dismissed',
  'death',
];

export type TurnoverStaffRow = {
  category: TurnoverCategory;
  categoryLabel: string;
  staffName: string;
  gender: string;
  pwd: string;
  designation: string;
  dateOfAppointment: string | null;
  dateOfSeparation: string | null;
};

export type StaffTurnoverReport = {
  facultyName: string;
  departmentName: string;
  turnoverReasonName: string;
  numberOfStaff: number;
  rows: TurnoverStaffRow[];
  source: 'synced';
  syncedStaffCount: number;
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
    reasons: { value: string; label: string }[];
  };
};

export type TurnoverCategoryFilter = TurnoverCategory | 'all';

export type TurnoverPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

type NormalizedStaff = {
  staffName: string;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  isPwd: boolean;
  designation: string;
  dateOfAppointment: string | null;
  dateOfSeparation: string | null;
  category: TurnoverCategory;
  faculty: string;
  department: string;
};

function normalizeGender(sex: string | null | undefined): 'male' | 'female' | null {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return null;
}

export function mapEmploymentStatusToTurnoverCategory(
  employmentStatus: string | null | undefined
): TurnoverCategory | null {
  const emp = (employmentStatus || '').toLowerCase();
  if (emp.includes('retir')) return 'retired';
  if (emp.includes('resign')) return 'resigned';
  if (emp.includes('termin') || emp.includes('dismiss')) return 'terminated_dismissed';
  if (emp.includes('deceas')) return 'death';
  return null;
}

function formatGenderDisplay(gender: 'male' | 'female' | null): string {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return '—';
}

function formatPwdDisplay(disabilityStatus: string | null): string {
  if (disabilityStatus === 'Yes') return 'Yes';
  if (disabilityStatus === 'No') return 'No';
  return '—';
}

function separationDate(
  category: TurnoverCategory,
  retirementDate: string | null,
  contractEnd: string | null
): string | null {
  if (category === 'retired' && retirementDate) return retirementDate;
  return contractEnd || retirementDate;
}

type DbStaffRow = {
  full_name: string | null;
  gender: string | null;
  disability_status: string | null;
  designation_grade: string | null;
  position: string | null;
  faculty_office: string | null;
  department: string | null;
  date_first_appointment: string | null;
  retirement_date: string | null;
  contract_end_date: string | null;
  employment_status: string | null;
};

async function loadSeparatedStaff(): Promise<NormalizedStaff[]> {
  const rows = (await query({
    query: `
      SELECT
        u.full_name,
        u.gender,
        u.disability_status,
        u.designation_grade,
        u.position,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
        DATE_FORMAT(u.retirement_date, '%Y-%m-%d') AS retirement_date,
        DATE_FORMAT(COALESCE(u.contract_end_date, u.contract_end), '%Y-%m-%d') AS contract_end_date,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
    `,
    values: [],
  })) as DbStaffRow[];

  return rows
    .map((r) => {
      const category = mapEmploymentStatusToTurnoverCategory(r.employment_status);
      if (!category) return null;

      const disabilityStatus = r.disability_status?.trim() || null;
      const gender = normalizeGender(r.gender);

      return {
        staffName: (r.full_name || '').trim() || '—',
        gender,
        disability_status: disabilityStatus,
        isPwd: disabilityStatus === 'Yes',
        designation: normalizePositionLabel(r.designation_grade || r.position),
        dateOfAppointment: r.date_first_appointment,
        dateOfSeparation: separationDate(
          category,
          r.retirement_date,
          r.contract_end_date
        ),
        category,
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
      };
    })
    .filter((s): s is NormalizedStaff => s !== null);
}

async function loadAllSyncedForFilterOptions(): Promise<
  { faculty: string; department: string }[]
> {
  const rows = (await query({
    query: `
      SELECT
        u.faculty_office,
        COALESCE(d.name, '') AS department
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

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: TurnoverPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesCategoryFilter(
  staff: NormalizedStaff,
  categoryFilter: TurnoverCategoryFilter
): boolean {
  if (categoryFilter === 'all') return true;
  return staff.category === categoryFilter;
}

function matchesFilter(
  staff: NormalizedStaff,
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: TurnoverPwdFilter,
  categoryFilter: TurnoverCategoryFilter
): boolean {
  if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  if (!matchesCategoryFilter(staff, categoryFilter)) return false;
  return true;
}

function buildDepartmentFilterOptions(
  staffList: { faculty: string; department: string }[]
): {
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

export function buildTurnoverReport(
  staffList: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: TurnoverPwdFilter,
  categoryFilter: TurnoverCategoryFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  syncedStaffCount: number
): StaffTurnoverReport {
  const filtered = staffList
    .filter((s) => matchesFilter(s, facultyFilter, departmentFilter, pwdFilter, categoryFilter))
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: 'base' }));

  const rows: TurnoverStaffRow[] = filtered.map((staff) => ({
    category: staff.category,
    categoryLabel: TURNOVER_CATEGORY_LABELS[staff.category],
    staffName: staff.staffName,
    gender: formatGenderDisplay(staff.gender),
    pwd: formatPwdDisplay(staff.disability_status),
    designation: staff.designation,
    dateOfAppointment: staff.dateOfAppointment,
    dateOfSeparation: staff.dateOfSeparation,
  }));

  const facultyName =
    facultyFilter && facultyFilter !== 'All Faculties' ? facultyFilter : '—';
  const departmentName =
    departmentFilter && departmentFilter !== 'All Departments' ? departmentFilter : '—';
  const turnoverReasonName =
    categoryFilter === 'all'
      ? 'All reasons'
      : TURNOVER_CATEGORY_LABELS[categoryFilter];

  return {
    facultyName,
    departmentName,
    turnoverReasonName,
    numberOfStaff: rows.length,
    rows,
    source: 'synced',
    syncedStaffCount,
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
      reasons: [
        { value: 'all', label: 'All reasons' },
        ...TURNOVER_CATEGORY_ORDER.map((c) => ({
          value: c,
          label: TURNOVER_CATEGORY_LABELS[c],
        })),
      ],
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): TurnoverPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function normalizeCategoryFilter(value: string | null | undefined): TurnoverCategoryFilter {
  if (
    value === 'retired' ||
    value === 'resigned' ||
    value === 'terminated_dismissed' ||
    value === 'death'
  ) {
    return value;
  }
  return 'all';
}

export async function generateStaffTurnoverReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
  reason?: string | null;
}): Promise<StaffTurnoverReport> {
  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const [separated, filterRows] = await Promise.all([
    loadSeparatedStaff(),
    loadAllSyncedForFilterOptions(),
  ]);

  const faculties = Array.from(new Set(filterRows.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departmentFilterOptions = buildDepartmentFilterOptions(filterRows);

  return buildTurnoverReport(
    separated,
    options.faculty || null,
    options.department || null,
    normalizePwdFilter(options.pwd),
    normalizeCategoryFilter(options.reason),
    faculties,
    departmentFilterOptions,
    syncedStaffCount
  );
}
