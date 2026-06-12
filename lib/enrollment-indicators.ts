import { query } from '@/lib/db';
import { listAcademicStaffFacultyOptions } from '@/lib/academic-staff-locations';
import {
  ENROLLMENT_FACULTY_UNSPECIFIED,
  normalizeEnrollmentFacultyName,
  type EnrollmentFacultyBreakdownRow,
} from '@/lib/ambassador/enrollment-records';

export { ENROLLMENT_FACULTY_UNSPECIFIED } from '@/lib/ambassador/enrollment-records';
export type { EnrollmentFacultyBreakdownRow } from '@/lib/ambassador/enrollment-records';

let ensuredFacultyColumns = false;

export function normalizeFacultyName(raw: unknown): string {
  return normalizeEnrollmentFacultyName(raw);
}

export async function ensureEnrollmentFacultyColumns(): Promise<void> {
  if (ensuredFacultyColumns) return;

  for (const table of ['staff_programme_enrollment', 'staff_course_unit_enrollment']) {
    try {
      await query({
        query: `ALTER TABLE ${table} ADD COLUMN faculty_name VARCHAR(255) NOT NULL DEFAULT '${ENROLLMENT_FACULTY_UNSPECIFIED}' AFTER id`,
      });
    } catch (e: unknown) {
      const err = e as { errno?: number };
      if (err.errno !== 1060) throw e;
    }
  }

  try {
    await query({ query: 'ALTER TABLE staff_programme_enrollment DROP INDEX uq_programme_enrollment_name' });
  } catch {
    /* index may not exist */
  }
  try {
    await query({
      query:
        'ALTER TABLE staff_programme_enrollment ADD UNIQUE KEY uq_programme_faculty_name (faculty_name, programme_name)',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1061) throw e;
  }

  try {
    await query({ query: 'ALTER TABLE staff_course_unit_enrollment DROP INDEX uq_course_unit_enrollment_name' });
  } catch {
    /* index may not exist */
  }
  try {
    await query({
      query:
        'ALTER TABLE staff_course_unit_enrollment ADD UNIQUE KEY uq_course_unit_faculty_name (faculty_name, course_unit_name)',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1061) throw e;
  }

  ensuredFacultyColumns = true;
}

export type EnrollmentIndicatorSummary = {
  programme: {
    programmes: number;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
  };
  courseUnit: {
    courseUnits: number;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
    pwdCount: number;
  };
  byFaculty: EnrollmentFacultyBreakdownRow[];
};

function facultyWhereClause(
  facultyFilter: string | null | undefined,
  alias: string
): { sql: string; values: string[] } {
  if (!facultyFilter || facultyFilter === 'all') {
    return { sql: '', values: [] };
  }
  return { sql: ` AND ${alias}.faculty_name = ?`, values: [facultyFilter] };
}

export async function summarizeEnrollmentIndicators(
  facultyFilter?: string | null
): Promise<EnrollmentIndicatorSummary> {
  await ensureEnrollmentFacultyColumns();

  const progWhere = facultyWhereClause(facultyFilter, 'p');
  const cuWhere = facultyWhereClause(facultyFilter, 'c');

  const empty: EnrollmentIndicatorSummary = {
    programme: { programmes: 0, totalStudents: 0, maleCount: 0, femaleCount: 0, pwdCount: 0 },
    courseUnit: { courseUnits: 0, totalStudents: 0, maleCount: 0, femaleCount: 0, pwdCount: 0 },
    byFaculty: [],
  };

  try {
    const progRows = (await query({
      query: `
        SELECT
          COUNT(*) AS programmes,
          COALESCE(SUM(total_students), 0) AS total_students,
          COALESCE(SUM(male_count), 0) AS male_count,
          COALESCE(SUM(female_count), 0) AS female_count,
          COALESCE(SUM(pwd_count), 0) AS pwd_count
        FROM staff_programme_enrollment p
        WHERE 1=1${progWhere.sql}
      `,
      values: progWhere.values,
    })) as {
      programmes: number;
      total_students: number;
      male_count: number;
      female_count: number;
      pwd_count: number;
    }[];

    const cuRows = (await query({
      query: `
        SELECT
          COUNT(*) AS course_units,
          COALESCE(SUM(total_students), 0) AS total_students,
          COALESCE(SUM(male_count), 0) AS male_count,
          COALESCE(SUM(female_count), 0) AS female_count,
          COALESCE(SUM(pwd_count), 0) AS pwd_count
        FROM staff_course_unit_enrollment c
        WHERE 1=1${cuWhere.sql}
      `,
      values: cuWhere.values,
    })) as {
      course_units: number;
      total_students: number;
      male_count: number;
      female_count: number;
      pwd_count: number;
    }[];

    const byFaculty = (await query({
      query: `
        SELECT
          faculty_name,
          SUM(programme_count) AS programme_count,
          SUM(course_unit_count) AS course_unit_count,
          SUM(total_students) AS total_students,
          SUM(male_count) AS male_count,
          SUM(female_count) AS female_count,
          SUM(pwd_count) AS pwd_count
        FROM (
          SELECT
            faculty_name,
            COUNT(*) AS programme_count,
            0 AS course_unit_count,
            COALESCE(SUM(total_students), 0) AS total_students,
            COALESCE(SUM(male_count), 0) AS male_count,
            COALESCE(SUM(female_count), 0) AS female_count,
            COALESCE(SUM(pwd_count), 0) AS pwd_count
          FROM staff_programme_enrollment
          GROUP BY faculty_name
          UNION ALL
          SELECT
            faculty_name,
            0 AS programme_count,
            COUNT(*) AS course_unit_count,
            COALESCE(SUM(total_students), 0) AS total_students,
            COALESCE(SUM(male_count), 0) AS male_count,
            COALESCE(SUM(female_count), 0) AS female_count,
            COALESCE(SUM(pwd_count), 0) AS pwd_count
          FROM staff_course_unit_enrollment
          GROUP BY faculty_name
        ) combined
        GROUP BY faculty_name
        ORDER BY faculty_name ASC
      `,
      values: [],
    })) as {
      faculty_name: string;
      programme_count: number;
      course_unit_count: number;
      total_students: number;
      male_count: number;
      female_count: number;
      pwd_count: number;
    }[];

    const p = progRows[0];
    const c = cuRows[0];

    return {
      programme: {
        programmes: Number(p?.programmes ?? 0),
        totalStudents: Number(p?.total_students ?? 0),
        maleCount: Number(p?.male_count ?? 0),
        femaleCount: Number(p?.female_count ?? 0),
        pwdCount: Number(p?.pwd_count ?? 0),
      },
      courseUnit: {
        courseUnits: Number(c?.course_units ?? 0),
        totalStudents: Number(c?.total_students ?? 0),
        maleCount: Number(c?.male_count ?? 0),
        femaleCount: Number(c?.female_count ?? 0),
        pwdCount: Number(c?.pwd_count ?? 0),
      },
      byFaculty: byFaculty.map((r) => ({
        facultyName: String(r.faculty_name || ENROLLMENT_FACULTY_UNSPECIFIED),
        programmeCount: Number(r.programme_count ?? 0),
        courseUnitCount: Number(r.course_unit_count ?? 0),
        totalStudents: Number(r.total_students ?? 0),
        maleCount: Number(r.male_count ?? 0),
        femaleCount: Number(r.female_count ?? 0),
        pwdCount: Number(r.pwd_count ?? 0),
      })),
    };
  } catch {
    return empty;
  }
}

/** Faculty / office options for enrollment filters — academic staff locations plus saved values. */
export async function listEnrollmentFacultyOptions(): Promise<string[]> {
  await ensureEnrollmentFacultyColumns();

  const names = new Set<string>();

  try {
    for (const faculty of await listAcademicStaffFacultyOptions()) {
      if (faculty) names.add(faculty);
    }
  } catch {
    /* users table may not be ready */
  }

  try {
    const fromData = (await query({
      query: `
        SELECT DISTINCT faculty_name FROM staff_programme_enrollment
        UNION
        SELECT DISTINCT faculty_name FROM staff_course_unit_enrollment
        ORDER BY faculty_name ASC
      `,
      values: [],
    })) as { faculty_name: string }[];
    for (const r of fromData) {
      const label = String(r.faculty_name || '').trim();
      if (label && label !== ENROLLMENT_FACULTY_UNSPECIFIED) names.add(label);
    }
  } catch {
    /* tables may not exist */
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
