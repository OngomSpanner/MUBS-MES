import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';

export type BenefitType =
  | 'medical_refund'
  | 'nssf'
  | 'wedding_transport'
  | 'obituary'
  | 'workmanship_compensation'
  | 'biological_scheme';

export type BenefitsPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type GenderCounts = { male: number; female: number; pwd: number };

export type BenefitsTableRow = {
  benefitType: BenefitType;
  benefitLabel: string;
  byYear: Record<string, GenderCounts>;
};

export type StaffBenefitsReport = {
  facultyName: string;
  departmentName: string;
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  rows: BenefitsTableRow[];
  totals: Record<string, GenderCounts>;
  source: 'synced';
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
  };
};

export const BENEFIT_TYPES: { value: BenefitType; label: string }[] = [
  { value: 'medical_refund', label: 'Medical refund' },
  { value: 'nssf', label: 'NSSF' },
  { value: 'wedding_transport', label: 'Wedding transport allowances' },
  { value: 'obituary', label: 'Obituary facilitation' },
  { value: 'workmanship_compensation', label: 'Workmanship compensation' },
  { value: 'biological_scheme', label: 'Biological scheme' },
];

type NormalizedStaff = {
  userId: number;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  isPwd: boolean;
  faculty: string;
  department: string;
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

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: BenefitsPwdFilter): boolean {
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
  pwdFilter: BenefitsPwdFilter
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

function normalizePwdFilter(value: string | null | undefined): BenefitsPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

async function loadBenefitEntries(
  yearKeys: string[]
): Promise<{ user_id: number; financial_year_key: string; benefit_type: BenefitType }[]> {
  if (yearKeys.length === 0) return [];
  const yearPlaceholders = yearKeys.map(() => '?').join(',');

  try {
    return (await query({
      query: `
        SELECT user_id, financial_year_key, benefit_type
        FROM staff_benefit_entries
        WHERE financial_year_key IN (${yearPlaceholders})
          AND received = 1
      `,
      values: yearKeys,
    })) as { user_id: number; financial_year_key: string; benefit_type: BenefitType }[];
  } catch {
    return [];
  }
}

async function loadStaffByIds(userIds: number[]): Promise<NormalizedStaff[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(',');

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
        AND u.id IN (${placeholders})
    `,
    values: userIds,
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
    .map((r) => {
      const disabilityStatus = r.disability_status?.trim() || null;
      return {
        userId: r.user_id,
        gender: normalizeGender(r.gender),
        disability_status: disabilityStatus,
        isPwd: disabilityStatus === 'Yes',
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
      };
    });
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

export async function generateStaffBenefitsReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
}): Promise<StaffBenefitsReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);

  const entries = await loadBenefitEntries(yearKeys);
  const allUserIds = Array.from(new Set(entries.map((e) => e.user_id)));
  const staffList = await loadStaffByIds(allUserIds);

  const pwdFilter = normalizePwdFilter(options.pwd);
  const filteredStaff = staffList.filter((s) =>
    matchesFilter(s, options.faculty || null, options.department || null, pwdFilter)
  );
  const staffById = new Map(filteredStaff.map((s) => [s.userId, s]));

  const rows: BenefitsTableRow[] = BENEFIT_TYPES.map((b) => ({
    benefitType: b.value,
    benefitLabel: b.label,
    byYear: emptyCountsByYear(yearKeys),
  }));
  const rowByType = new Map(rows.map((r) => [r.benefitType, r]));
  const totals = emptyCountsByYear(yearKeys);

  for (const entry of entries) {
    const staff = staffById.get(entry.user_id);
    if (!staff) continue;

    const row = rowByType.get(entry.benefit_type);
    if (!row) continue;

    addToCounts(row.byYear[entry.financial_year_key], staff);
    addToCounts(totals[entry.financial_year_key], staff);
  }

  const deptOptions = buildDepartmentFilterOptions(staffList);
  const faculties = Array.from(new Set(staffList.map((s) => s.faculty).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const facultyName =
    options.faculty && options.faculty !== 'All Faculties' ? options.faculty : '—';
  const departmentName =
    options.department && options.department !== 'All Departments' ? options.department : '—';

  return {
    facultyName,
    departmentName,
    numberOfStaff: filteredStaff.length,
    yearKeys,
    years,
    rows,
    totals,
    source: 'synced',
    filterOptions: {
      faculties: ['All Faculties', ...faculties],
      departments: ['All Departments', ...deptOptions.allDepartments],
      departmentsByFaculty: deptOptions.departmentsByFaculty,
    },
  };
}
