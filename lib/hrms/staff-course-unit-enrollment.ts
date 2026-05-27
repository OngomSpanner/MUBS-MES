import { query } from '@/lib/db';

export type CourseUnitEnrollmentGenderFilter = 'all' | 'male' | 'female';
export type CourseUnitEnrollmentPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type CourseUnitEnrollmentRow = {
  courseUnitName: string;
  studentCount: number;
};

export type StaffCourseUnitEnrollmentReport = {
  rows: CourseUnitEnrollmentRow[];
  totals: {
    studentCount: number;
  };
};

type RawEnrollmentRow = {
  courseUnitName: string;
  totalStudents: number;
  male: number;
  female: number;
  pwd: number;
};

function normalizeGenderFilter(value: string | null | undefined): CourseUnitEnrollmentGenderFilter {
  if (value === 'male' || value === 'female') return value;
  return 'all';
}

function normalizePwdFilter(value: string | null | undefined): CourseUnitEnrollmentPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function studentCountForRow(row: RawEnrollmentRow, gender: CourseUnitEnrollmentGenderFilter, pwd: CourseUnitEnrollmentPwdFilter): number {
  if (pwd === 'yes') return row.pwd;
  if (pwd === 'not_recorded') return 0;

  let byGender: number;
  if (gender === 'male') byGender = row.male;
  else if (gender === 'female') byGender = row.female;
  else byGender = row.totalStudents;

  if (pwd === 'no') {
    if (gender === 'all') return Math.max(0, row.totalStudents - row.pwd);
    return byGender;
  }

  return byGender;
}

export async function generateStaffCourseUnitEnrollmentReport(options?: {
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffCourseUnitEnrollmentReport> {
  const genderFilter = normalizeGenderFilter(options?.gender);
  const pwdFilter = normalizePwdFilter(options?.pwd);

  let rawRows: RawEnrollmentRow[] = [];

  try {
    const dbRows = (await query({
      query: `
        SELECT
          course_unit_name,
          total_students,
          male_count,
          female_count,
          pwd_count
        FROM staff_course_unit_enrollment
        ORDER BY course_unit_name ASC
      `,
      values: [],
    })) as {
      course_unit_name: string;
      total_students: number;
      male_count: number;
      female_count: number;
      pwd_count: number;
    }[];

    rawRows = dbRows.map((r) => ({
      courseUnitName: (r.course_unit_name || '').trim(),
      totalStudents: Number(r.total_students ?? 0),
      male: Number(r.male_count ?? 0),
      female: Number(r.female_count ?? 0),
      pwd: Number(r.pwd_count ?? 0),
    }));
  } catch {
    // table may not exist
  }

  const rows: CourseUnitEnrollmentRow[] = rawRows.map((r) => ({
    courseUnitName: r.courseUnitName,
    studentCount: studentCountForRow(r, genderFilter, pwdFilter),
  }));

  const totals = rows.reduce((acc, r) => ({ studentCount: acc.studentCount + r.studentCount }), { studentCount: 0 });

  return { rows, totals };
}

