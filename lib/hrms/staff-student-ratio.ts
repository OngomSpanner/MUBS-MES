import { query } from '@/lib/db';

export type StaffStudentRatioGenderFilter = 'all' | 'male' | 'female';
export type StaffStudentRatioPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type StaffStudentRatioRow = {
  programmeName: string;
  facultyName: string;
  departmentName: string;
  staffCount: number;
  studentCount: number;
  /** e.g. "1 : 45" (one staff member per 45 students) */
  ratioLabel: string;
};

export type StaffStudentRatioReport = {
  rows: StaffStudentRatioRow[];
  totals: {
    programmeCount: number;
    staffCount: number;
    studentCount: number;
    ratioLabel: string;
  };
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
    programmes: string[];
  };
};

type LecturerRow = {
  userId: number;
  faculty: string | null;
  department: string | null;
  programme: string | null;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
};

type EnrollmentRow = {
  programmeName: string;
  totalStudents: number;
  male: number;
  female: number;
  pwd: number;
};

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

function isTeachingFacultyName(name: string | null | undefined): boolean {
  return (name || '').trim().toLowerCase().includes('faculty');
}

function programmeKey(name: string): string {
  return name.trim().toLowerCase();
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

function normalizePwdFilter(value: string | null | undefined): StaffStudentRatioPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function normalizeGenderFilter(value: string | null | undefined): StaffStudentRatioGenderFilter {
  if (value === 'male' || value === 'female') return value;
  return 'all';
}

function matchesPwdFilterStaff(
  staff: { disability_status: string | null },
  pwdFilter: StaffStudentRatioPwdFilter
): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesGenderFilterStaff(
  staff: { gender: 'male' | 'female' | null },
  genderFilter: StaffStudentRatioGenderFilter
): boolean {
  if (genderFilter === 'all') return true;
  return staff.gender === genderFilter;
}

function studentCountForEnrollment(
  row: EnrollmentRow,
  genderFilter: StaffStudentRatioGenderFilter,
  pwdFilter: StaffStudentRatioPwdFilter
): number {
  if (pwdFilter === 'yes') return row.pwd;
  if (pwdFilter === 'not_recorded') return 0;

  let byGender: number;
  if (genderFilter === 'male') byGender = row.male;
  else if (genderFilter === 'female') byGender = row.female;
  else byGender = row.totalStudents;

  if (pwdFilter === 'no') {
    if (genderFilter === 'all') return Math.max(0, row.totalStudents - row.pwd);
    return byGender;
  }

  return byGender;
}

function matchesTextFilter(value: string | null, filter: string | null, allLabel: string): boolean {
  if (!filter || filter === allLabel) return true;
  return (value || '').toLowerCase() === filter.toLowerCase();
}

function buildOptions(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v || '').trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function buildDepartmentsByFaculty(locations: { faculty: string; department: string }[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const loc of locations) {
    const f = loc.faculty.trim();
    const d = loc.department.trim();
    if (!f || !d || !isTeachingFacultyName(f)) continue;
    if (!map.has(f)) map.set(f, new Set());
    map.get(f)!.add(d);
  }
  const out: Record<string, string[]> = {};
  for (const [f, set] of map) {
    out[f] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  return out;
}

function pickDisplayLabel(values: Set<string>): string {
  const list = Array.from(values).filter(Boolean).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  if (list.length === 0) return '—';
  if (list.length === 1) return list[0];
  return list[0];
}

function formatRatio(staffCount: number, studentCount: number): string {
  if (staffCount <= 0) return studentCount > 0 ? 'No staff' : '—';
  if (studentCount <= 0) return 'No students';
  const studentsPerStaff = Math.round((studentCount / staffCount) * 10) / 10;
  return `1 : ${studentsPerStaff % 1 === 0 ? Math.round(studentsPerStaff) : studentsPerStaff}`;
}

function formatTotalRatio(staffCount: number, studentCount: number): string {
  if (staffCount <= 0) return studentCount > 0 ? 'No staff' : '—';
  if (studentCount <= 0) return 'No students';
  const n = Math.round(studentCount / staffCount);
  return `1 : ${n}`;
}

async function loadTeachingStaffLocations(): Promise<{ faculty: string; department: string }[]> {
  const rows = (await query({
    query: `
      SELECT u.faculty_office, COALESCE(d.name, '') AS department, u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL AND u.staff_category = 'Academic'
    `,
    values: [],
  })) as { faculty_office: string | null; department: string | null; employment_status: string | null }[];

  return rows
    .filter((r) => !isSeparatedEmployment(r.employment_status))
    .map((r) => ({
      faculty: (r.faculty_office || '').trim(),
      department: (r.department || '').trim(),
    }))
    .filter((r) => r.faculty && isTeachingFacultyName(r.faculty));
}

async function loadLecturerRows(): Promise<LecturerRow[]> {
  try {
    const rows = (await query({
      query: `
        SELECT
          u.id AS user_id,
          u.gender,
          u.disability_status,
          u.employment_status,
          COALESCE(NULLIF(TRIM(e.faculty_name), ''), NULLIF(TRIM(u.faculty_office), '')) AS faculty_name,
          COALESCE(NULLIF(TRIM(e.department_name), ''), NULLIF(TRIM(d.name), '')) AS department_name,
          e.programme_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN staff_student_ratio_entries e ON e.user_id = u.id
        WHERE u.hrms_staff_id IS NOT NULL AND u.staff_category = 'Academic'
      `,
      values: [],
    })) as {
      user_id: number;
      gender: string | null;
      disability_status: string | null;
      employment_status: string | null;
      faculty_name: string | null;
      department_name: string | null;
      programme_name: string | null;
    }[];

    return rows
      .filter((r) => !isSeparatedEmployment(r.employment_status))
      .map((r) => ({
        userId: r.user_id,
        gender: normalizeGender(r.gender),
        disability_status: r.disability_status?.trim() || null,
        faculty: r.faculty_name?.trim() || null,
        department: r.department_name?.trim() || null,
        programme: r.programme_name?.trim() || null,
      }));
  } catch {
    const rows = (await query({
      query: `
        SELECT u.id AS user_id, u.gender, u.disability_status, u.employment_status,
               u.faculty_office AS faculty_name, COALESCE(d.name, '') AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.hrms_staff_id IS NOT NULL AND u.staff_category = 'Academic'
      `,
      values: [],
    })) as {
      user_id: number;
      gender: string | null;
      disability_status: string | null;
      employment_status: string | null;
      faculty_name: string | null;
      department_name: string | null;
    }[];

    return rows
      .filter((r) => !isSeparatedEmployment(r.employment_status))
      .map((r) => ({
        userId: r.user_id,
        gender: normalizeGender(r.gender),
        disability_status: r.disability_status?.trim() || null,
        faculty: r.faculty_name?.trim() || null,
        department: r.department_name?.trim() || null,
        programme: null,
      }));
  }
}

async function loadProgrammeEnrollment(): Promise<EnrollmentRow[]> {
  try {
    const rows = (await query({
      query: `
        SELECT programme_name, total_students, male_count, female_count, pwd_count
        FROM staff_programme_enrollment
        ORDER BY programme_name ASC
      `,
      values: [],
    })) as {
      programme_name: string;
      total_students: number;
      male_count: number;
      female_count: number;
      pwd_count: number;
    }[];

    return rows.map((r) => ({
      programmeName: (r.programme_name || '').trim(),
      totalStudents: Number(r.total_students ?? 0),
      male: Number(r.male_count ?? 0),
      female: Number(r.female_count ?? 0),
      pwd: Number(r.pwd_count ?? 0),
    }));
  } catch {
    return [];
  }
}

type ProgrammeBucket = {
  displayName: string;
  faculties: Set<string>;
  departments: Set<string>;
  staffIds: Set<number>;
  studentCount: number;
};

export async function generateStaffStudentRatioReport(options: {
  faculty?: string | null;
  department?: string | null;
  programme?: string | null;
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffStudentRatioReport> {
  const genderFilter = normalizeGenderFilter(options.gender);
  const pwdFilter = normalizePwdFilter(options.pwd);

  const [lecturers, enrollments, teachingLocations] = await Promise.all([
    loadLecturerRows(),
    loadProgrammeEnrollment(),
    loadTeachingStaffLocations(),
  ]);

  const teachingFaculties = buildOptions(teachingLocations.map((l) => l.faculty));
  const faculties = ['All Faculties', ...teachingFaculties];
  const departmentsByFaculty = buildDepartmentsByFaculty(teachingLocations);
  const allDepartments = Array.from(new Set(Object.values(departmentsByFaculty).flat())).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departments = ['All Departments', ...allDepartments];

  const buckets = new Map<string, ProgrammeBucket>();

  for (const e of enrollments) {
    if (!e.programmeName) continue;
    const key = programmeKey(e.programmeName);
    if (!buckets.has(key)) {
      buckets.set(key, {
        displayName: e.programmeName,
        faculties: new Set(),
        departments: new Set(),
        staffIds: new Set(),
        studentCount: 0,
      });
    }
    buckets.get(key)!.studentCount = studentCountForEnrollment(e, genderFilter, pwdFilter);
  }

  for (const lec of lecturers) {
    if (!lec.programme) continue;
    if (!matchesGenderFilterStaff(lec, genderFilter)) continue;
    if (!matchesPwdFilterStaff(lec, pwdFilter)) continue;

    const key = programmeKey(lec.programme);
    if (!buckets.has(key)) {
      buckets.set(key, {
        displayName: lec.programme,
        faculties: new Set(),
        departments: new Set(),
        staffIds: new Set(),
        studentCount: 0,
      });
    }
    const b = buckets.get(key)!;
    b.staffIds.add(lec.userId);
    if (lec.faculty) b.faculties.add(lec.faculty);
    if (lec.department) b.departments.add(lec.department);
  }

  const programmeNames = Array.from(buckets.values())
    .map((b) => b.displayName)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const programmes = ['All Programmes', ...programmeNames];

  const rows: StaffStudentRatioRow[] = [];
  const distinctStaffIds = new Set<number>();

  for (const b of buckets.values()) {
    const facultyName = pickDisplayLabel(b.faculties);
    const departmentName = pickDisplayLabel(b.departments);
    const staffCount = b.staffIds.size;

    if (!matchesTextFilter(facultyName, options.faculty || null, 'All Faculties')) {
      const facultyMatch = Array.from(b.faculties).some((f) =>
        matchesTextFilter(f, options.faculty || null, 'All Faculties')
      );
      if (!facultyMatch) continue;
    }
    if (!matchesTextFilter(departmentName, options.department || null, 'All Departments')) {
      const deptMatch = Array.from(b.departments).some((d) =>
        matchesTextFilter(d, options.department || null, 'All Departments')
      );
      if (!deptMatch) continue;
    }
    if (!matchesTextFilter(b.displayName, options.programme || null, 'All Programmes')) continue;

    for (const id of b.staffIds) distinctStaffIds.add(id);

    rows.push({
      programmeName: b.displayName,
      facultyName,
      departmentName,
      staffCount,
      studentCount: b.studentCount,
      ratioLabel: formatRatio(staffCount, b.studentCount),
    });
  }

  rows.sort((a, b) => a.programmeName.localeCompare(b.programmeName, undefined, { sensitivity: 'base' }));

  const totalStaff = distinctStaffIds.size;
  const totalStudents = rows.reduce((s, r) => s + r.studentCount, 0);

  return {
    rows,
    totals: {
      programmeCount: rows.length,
      staffCount: totalStaff,
      studentCount: totalStudents,
      ratioLabel: formatTotalRatio(totalStaff, totalStudents),
    },
    filterOptions: {
      faculties,
      departments,
      departmentsByFaculty,
      programmes,
    },
  };
}
