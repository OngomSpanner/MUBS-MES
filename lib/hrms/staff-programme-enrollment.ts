import { query } from '@/lib/db';

export type ProgrammeEnrollmentGenderFilter = 'all' | 'male' | 'female';
export type ProgrammeEnrollmentPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

export type ProgrammeEnrollmentRow = {
  programmeName: string;
  studentCount: number;
};

export type StaffProgrammeEnrollmentReport = {
  rows: ProgrammeEnrollmentRow[];
  totals: {
    studentCount: number;
  };
};

type RawEnrollmentRow = {
  programmeName: string;
  totalStudents: number;
  male: number;
  female: number;
  pwd: number;
  pwdDetails: string | null;
};

function normalizeGenderFilter(value: string | null | undefined): ProgrammeEnrollmentGenderFilter {
  if (value === 'male' || value === 'female') return value;
  return 'all';
}

function normalizePwdFilter(value: string | null | undefined): ProgrammeEnrollmentPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function studentCountForRow(
  row: RawEnrollmentRow,
  gender: ProgrammeEnrollmentGenderFilter,
  pwd: ProgrammeEnrollmentPwdFilter
): number {
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

export async function generateStaffProgrammeEnrollmentReport(options?: {
  gender?: string | null;
  pwd?: string | null;
}): Promise<StaffProgrammeEnrollmentReport> {
  const genderFilter = normalizeGenderFilter(options?.gender);
  const pwdFilter = normalizePwdFilter(options?.pwd);

  let rawRows: RawEnrollmentRow[] = [];

  try {
    const dbRows = (await query({
      query: `
        SELECT
          programme_name,
          total_students,
          male_count,
          female_count,
          pwd_count,
          pwd_details
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
      pwd_details: string | null;
    }[];

    rawRows = dbRows.map((r) => ({
      programmeName: (r.programme_name || '').trim(),
      totalStudents: Number(r.total_students ?? 0),
      male: Number(r.male_count ?? 0),
      female: Number(r.female_count ?? 0),
      pwd: Number(r.pwd_count ?? 0),
      pwdDetails: r.pwd_details?.trim() || null,
    }));
  } catch {
    // table may not exist
  }

  const rows: ProgrammeEnrollmentRow[] = rawRows.map((r) => ({
    programmeName: r.programmeName,
    studentCount: studentCountForRow(r, genderFilter, pwdFilter),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      studentCount: acc.studentCount + r.studentCount,
    }),
    { studentCount: 0 }
  );

  return { rows, totals };
}
