import { query } from '@/lib/db';

export type StaffStudentRatioGenderFilter = 'all' | 'male' | 'female';
export type StaffStudentRatioPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type StaffStudentRatioRow = {
  lecturerName: string;
  gender: string | null;
  pwdDetails: string | null;
  qualification: string | null;
  qualificationDetails: string | null;
};

export type StaffStudentRatioReport = {
  facultyName: string;
  departmentName: string;
  programmeName: string;
  courseUnitName: string;
  numberOfLecturers: number;
  rows: StaffStudentRatioRow[];
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
    programmes: string[];
    courseUnits: string[];
    courseUnitsByProgramme: Record<string, string[]>;
  };
};

type LecturerRow = {
  userId: number;
  lecturerName: string;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  disability_type: string | null;
  faculty: string | null;
  department: string | null;
  programme: string | null;
  courseUnit: string | null;
  qualification: string | null;
  qualificationDetails: string | null;
};

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

/** Teaching staff are posted to faculties/offices whose name includes "faculty". */
function isTeachingFacultyName(name: string | null | undefined): boolean {
  return (name || '').trim().toLowerCase().includes('faculty');
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

function matchesPwdFilter(staff: { disability_status: string | null }, pwdFilter: StaffStudentRatioPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesGenderFilter(staff: { gender: 'male' | 'female' | null }, genderFilter: StaffStudentRatioGenderFilter): boolean {
  if (genderFilter === 'all') return true;
  return staff.gender === genderFilter;
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

function buildCourseUnitsByProgramme(rows: LecturerRow[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const p = (r.programme || '').trim();
    const cu = (r.courseUnit || '').trim();
    if (!p || !cu) continue;
    if (!map.has(p)) map.set(p, new Set());
    map.get(p)!.add(cu);
  }
  const out: Record<string, string[]> = {};
  for (const [p, set] of map) {
    out[p] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  return out;
}

async function loadTeachingStaffLocations(): Promise<{ faculty: string; department: string }[]> {
  const rows = (await query({
    query: `
      SELECT
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND u.staff_category = 'Academic'
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

async function loadAllRows(): Promise<LecturerRow[]> {
  try {
    const rows = (await query({
      query: `
        SELECT
          u.id AS user_id,
          u.full_name AS lecturer_name,
          u.gender,
          u.disability_status,
          u.disability_type,
          u.employment_status,
          COALESCE(NULLIF(TRIM(e.faculty_name), ''), NULLIF(TRIM(u.faculty_office), '')) AS faculty_name,
          COALESCE(NULLIF(TRIM(e.department_name), ''), NULLIF(TRIM(d.name), '')) AS department_name,
          e.programme_name,
          e.course_unit_name,
          e.qualification,
          e.qualification_details
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN staff_student_ratio_entries e ON e.user_id = u.id
        WHERE u.hrms_staff_id IS NOT NULL
          AND u.staff_category = 'Academic'
      `,
      values: [],
    })) as {
      user_id: number;
      lecturer_name: string;
      gender: string | null;
      disability_status: string | null;
      disability_type: string | null;
      employment_status: string | null;
      faculty_name: string | null;
      department_name: string | null;
      programme_name: string | null;
      course_unit_name: string | null;
      qualification: string | null;
      qualification_details: string | null;
    }[];

    return rows
      .filter((r) => !isSeparatedEmployment(r.employment_status))
      .map((r) => ({
        userId: r.user_id,
        lecturerName: (r.lecturer_name || '').trim(),
        gender: normalizeGender(r.gender),
        disability_status: r.disability_status?.trim() || null,
        disability_type: r.disability_type?.trim() || null,
        faculty: r.faculty_name?.trim() || null,
        department: r.department_name?.trim() || null,
        programme: r.programme_name?.trim() || null,
        courseUnit: r.course_unit_name?.trim() || null,
        qualification: r.qualification?.trim() || null,
        qualificationDetails: r.qualification_details?.trim() || null,
      }));
  } catch {
    const rows = (await query({
      query: `
        SELECT
          u.id AS user_id,
          u.full_name AS lecturer_name,
          u.gender,
          u.disability_status,
          u.disability_type,
          u.employment_status,
          u.faculty_office AS faculty_name,
          COALESCE(d.name, '') AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.hrms_staff_id IS NOT NULL
          AND u.staff_category = 'Academic'
      `,
      values: [],
    })) as {
      user_id: number;
      lecturer_name: string;
      gender: string | null;
      disability_status: string | null;
      disability_type: string | null;
      employment_status: string | null;
      faculty_name: string | null;
      department_name: string | null;
    }[];

    return rows
      .filter((r) => !isSeparatedEmployment(r.employment_status))
      .map((r) => ({
        userId: r.user_id,
        lecturerName: (r.lecturer_name || '').trim(),
        gender: normalizeGender(r.gender),
        disability_status: r.disability_status?.trim() || null,
        disability_type: r.disability_type?.trim() || null,
        faculty: r.faculty_name?.trim() || null,
        department: r.department_name?.trim() || null,
        programme: null,
        courseUnit: null,
        qualification: null,
        qualificationDetails: null,
      }));
  }
}

export async function generateStaffStudentRatioReport(options: {
  faculty?: string | null;
  department?: string | null;
  programme?: string | null;
  course_unit?: string | null;
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffStudentRatioReport> {
  const genderFilter = normalizeGenderFilter(options.gender);
  const pwdFilter = normalizePwdFilter(options.pwd);

  const [allRows, teachingLocations] = await Promise.all([loadAllRows(), loadTeachingStaffLocations()]);

  const teachingFaculties = buildOptions(teachingLocations.map((l) => l.faculty));
  const faculties = ['All Faculties', ...teachingFaculties];
  const departmentsByFaculty = buildDepartmentsByFaculty(teachingLocations);

  const allDepartments = Array.from(
    new Set(Object.values(departmentsByFaculty).flat())
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const departments = ['All Departments', ...allDepartments];

  const programmes = ['All Programmes', ...buildOptions(allRows.map((r) => r.programme))];
  const courseUnits = ['All Course Units', ...buildOptions(allRows.map((r) => r.courseUnit))];
  const courseUnitsByProgramme = buildCourseUnitsByProgramme(allRows);

  const filtered = allRows.filter((r) => {
    if (!matchesTextFilter(r.faculty, options.faculty || null, 'All Faculties')) return false;
    if (!matchesTextFilter(r.department, options.department || null, 'All Departments')) return false;
    if (!matchesTextFilter(r.programme, options.programme || null, 'All Programmes')) return false;
    if (!matchesTextFilter(r.courseUnit, options.course_unit || null, 'All Course Units')) return false;
    if (!matchesGenderFilter(r, genderFilter)) return false;
    if (!matchesPwdFilter(r, pwdFilter)) return false;
    return true;
  });

  const reportFacultyName = options.faculty && options.faculty !== 'All Faculties' ? options.faculty : '—';
  const reportDepartmentName = options.department && options.department !== 'All Departments' ? options.department : '—';
  const reportProgrammeName = options.programme && options.programme !== 'All Programmes' ? options.programme : '—';
  const reportCourseUnitName = options.course_unit && options.course_unit !== 'All Course Units' ? options.course_unit : '—';

  return {
    facultyName: reportFacultyName,
    departmentName: reportDepartmentName,
    programmeName: reportProgrammeName,
    courseUnitName: reportCourseUnitName,
    numberOfLecturers: filtered.length,
    rows: filtered.map((r) => ({
      lecturerName: r.lecturerName || '—',
      gender: r.gender ? (r.gender === 'male' ? 'Male' : 'Female') : '—',
      pwdDetails: r.disability_status === 'Yes' ? r.disability_type || '—' : '—',
      qualification: r.qualification || '—',
      qualificationDetails: r.qualificationDetails || '—',
    })),
    filterOptions: {
      faculties,
      departments,
      departmentsByFaculty,
      programmes,
      courseUnits,
      courseUnitsByProgramme,
    },
  };
}
