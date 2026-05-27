import { query } from '@/lib/db';
import { yearsSince } from '@/lib/staff-biodata';
import { normalizePositionLabel } from '@/lib/hrms/staff-establishment';

export type RetentionStaffRow = {
  staffName: string;
  gender: string;
  pwd: string;
  designation: string;
  yearsServed: number | null;
};

export type StaffRetentionReport = {
  facultyName: string;
  departmentName: string;
  numberOfStaff: number;
  rows: RetentionStaffRow[];
  source: 'synced';
  syncedStaffCount: number;
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
  };
};

export type RetentionPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

type NormalizedStaff = {
  staffName: string;
  gender: string;
  pwd: string;
  designation: string;
  yearsServed: number | null;
  faculty: string;
  department: string;
  disability_status: string | null;
};

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

function formatGenderDisplay(sex: string | null | undefined): string {
  const s = (sex || '').trim();
  if (!s) return '—';
  const lower = s.toLowerCase();
  if (lower === 'male' || lower === 'm') return 'Male';
  if (lower === 'female' || lower === 'f') return 'Female';
  return s;
}

function formatPwdDisplay(disabilityStatus: string | null): string {
  if (disabilityStatus === 'Yes') return 'Yes';
  if (disabilityStatus === 'No') return 'No';
  return '—';
}

function isSeparatedEmployment(employmentStatus: string | null | undefined): boolean {
  const emp = (employmentStatus || '').toLowerCase();
  return SEPARATED_EMPLOYMENT.some((x) => emp.includes(x));
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
  employment_status: string | null;
};

async function loadSyncedStaffForRetention(): Promise<NormalizedStaff[]> {
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

      const disabilityStatus = r.disability_status?.trim() || null;
      const staffName = (r.full_name || '').trim() || '—';

      return {
        staffName,
        gender: formatGenderDisplay(r.gender),
        pwd: formatPwdDisplay(disabilityStatus),
        designation: normalizePositionLabel(r.designation_grade || r.position),
        yearsServed: yearsSince(r.date_first_appointment),
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
        disability_status: disabilityStatus,
      };
    })
    .filter((s): s is NormalizedStaff => s !== null);
}

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: RetentionPwdFilter): boolean {
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
  pwdFilter: RetentionPwdFilter
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

export function buildRetentionReport(
  staffList: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: RetentionPwdFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  syncedStaffCount: number
): StaffRetentionReport {
  const filtered = staffList
    .filter((s) => matchesFilter(s, facultyFilter, departmentFilter, pwdFilter))
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: 'base' }));

  const rows: RetentionStaffRow[] = filtered.map((s) => ({
    staffName: s.staffName,
    gender: s.gender,
    pwd: s.pwd,
    designation: s.designation,
    yearsServed: s.yearsServed,
  }));

  const facultyName =
    facultyFilter && facultyFilter !== 'All Faculties' ? facultyFilter : '—';
  const departmentName =
    departmentFilter && departmentFilter !== 'All Departments' ? departmentFilter : '—';

  return {
    facultyName,
    departmentName,
    numberOfStaff: rows.length,
    rows,
    source: 'synced',
    syncedStaffCount,
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): RetentionPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

export async function generateStaffRetentionReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
}): Promise<StaffRetentionReport> {
  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const staffList = await loadSyncedStaffForRetention();

  const faculties = Array.from(new Set(staffList.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departmentFilterOptions = buildDepartmentFilterOptions(staffList);

  return buildRetentionReport(
    staffList,
    options.faculty || null,
    options.department || null,
    normalizePwdFilter(options.pwd),
    faculties,
    departmentFilterOptions,
    syncedStaffCount
  );
}
