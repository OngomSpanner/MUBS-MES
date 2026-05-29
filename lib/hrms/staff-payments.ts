import { query } from '@/lib/db';
import {
  getRollingReportFyWindow,
  labelsFromFyWindow,
} from '@/lib/financial-year';
import { normalizePositionLabel, POSITION_NOT_SPECIFIED } from '@/lib/hrms/staff-establishment';

export type PaymentType = 'wages' | 'salaries' | 'pension' | 'gratuity';
export type PaymentsPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type GenderCounts = { male: number; female: number; pwd: number };

export type PaymentsTableRow = {
  designation: string;
  byYear: Record<string, GenderCounts>;
};

export type StaffPaymentsReport = {
  facultyName: string;
  departmentName: string;
  paymentTypeName: string;
  numberOfStaff: number;
  /** Oldest → newest */
  yearKeys: string[];
  years: Record<string, string>;
  rows: PaymentsTableRow[];
  totals: Record<string, GenderCounts>;
  source: 'synced';
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
    paymentTypes: { value: PaymentType; label: string }[];
  };
};

type NormalizedStaff = {
  userId: number;
  position: string;
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

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: PaymentsPwdFilter): boolean {
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
  pwdFilter: PaymentsPwdFilter
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

function paymentTypeLabel(t: PaymentType): string {
  switch (t) {
    case 'wages':
      return 'Wages';
    case 'salaries':
      return 'Salaries';
    case 'pension':
      return 'Pension';
    case 'gratuity':
      return 'Gratuity';
  }
}

function normalizePaymentType(value: string | null | undefined): PaymentType {
  if (value === 'wages' || value === 'salaries' || value === 'pension' || value === 'gratuity') return value;
  return 'wages';
}

function normalizePwdFilter(value: string | null | undefined): PaymentsPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

async function loadPaidUserIdsByYear(
  yearKeys: string[],
  paymentType: PaymentType
): Promise<Record<string, number[]>> {
  if (yearKeys.length === 0) return {};
  const yearPlaceholders = yearKeys.map(() => '?').join(',');

  let rows: { user_id: number; financial_year_key: string }[] = [];
  try {
    rows = (await query({
      query: `
        SELECT user_id, financial_year_key
        FROM staff_payment_entries
        WHERE financial_year_key IN (${yearPlaceholders})
          AND payment_type = ?
          AND is_paid = 1
      `,
      values: [...yearKeys, paymentType],
    })) as typeof rows;
  } catch {
    return {};
  }

  const byYear: Record<string, number[]> = Object.fromEntries(yearKeys.map((k) => [k, []]));
  for (const r of rows) {
    if (!byYear[r.financial_year_key]) byYear[r.financial_year_key] = [];
    byYear[r.financial_year_key].push(r.user_id);
  }
  return byYear;
}

async function loadStaffByIds(userIds: number[]): Promise<NormalizedStaff[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(',');

  const rows = (await query({
    query: `
      SELECT
        u.id AS user_id,
        u.designation_grade,
        u.position,
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
    designation_grade: string | null;
    position: string | null;
    gender: string | null;
    disability_status: string | null;
    faculty_office: string | null;
    department: string | null;
    employment_status: string | null;
  }[];

  return rows
    .filter((r) => !isSeparatedEmployment(r.employment_status))
    .map((r) => {
      const psn = r.designation_grade || r.position;
      const disabilityStatus = r.disability_status?.trim() || null;
      return {
        userId: r.user_id,
        position: normalizePositionLabel(psn),
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

function sortPositions(a: string, b: string): number {
  if (a === POSITION_NOT_SPECIFIED) return 1;
  if (b === POSITION_NOT_SPECIFIED) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export async function generateStaffPaymentsReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
  payment_type?: string | null;
}): Promise<StaffPaymentsReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);

  const paymentType = normalizePaymentType(options.payment_type);
  const paymentTypeName = paymentTypeLabel(paymentType);

  const paidByYear = await loadPaidUserIdsByYear(yearKeys, paymentType);
  const allPaidIds = Array.from(new Set(Object.values(paidByYear).flat()));
  const staffList = await loadStaffByIds(allPaidIds);

  const deptOptions = buildDepartmentFilterOptions(staffList);
  const faculties = Array.from(new Set(staffList.map((s) => s.faculty).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const pwdFilter = normalizePwdFilter(options.pwd);
  const filteredStaff = staffList.filter((s) => matchesFilter(s, options.faculty || null, options.department || null, pwdFilter));

  // designation -> byYear counts (only for staff who have payment entry in that FY)
  const designationMap = new Map<string, PaymentsTableRow>();
  const totals = emptyCountsByYear(yearKeys);

  const staffById = new Map(filteredStaff.map((s) => [s.userId, s]));
  for (const y of yearKeys) {
    const paidIds = paidByYear[y] ?? [];
    for (const id of paidIds) {
      const staff = staffById.get(id);
      if (!staff) continue;

      if (!designationMap.has(staff.position)) {
        designationMap.set(staff.position, { designation: staff.position, byYear: emptyCountsByYear(yearKeys) });
      }
      const row = designationMap.get(staff.position)!;
      addToCounts(row.byYear[y], staff);
      addToCounts(totals[y], staff);
    }
  }

  const rows = Array.from(designationMap.values()).sort((a, b) => sortPositions(a.designation, b.designation));

  const facultyName =
    options.faculty && options.faculty !== 'All Faculties' ? options.faculty : '—';
  const departmentName =
    options.department && options.department !== 'All Departments' ? options.department : '—';

  return {
    facultyName,
    departmentName,
    paymentTypeName,
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
      paymentTypes: [
        { value: 'wages', label: 'No of staff paid wages' },
        { value: 'salaries', label: 'No of staff paid salaries' },
        { value: 'pension', label: 'No of staff paid pension' },
        { value: 'gratuity', label: 'No of staff paid gratuity' },
      ],
    },
  };
}

