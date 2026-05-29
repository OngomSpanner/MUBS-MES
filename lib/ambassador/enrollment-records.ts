export type ProgrammeEnrollmentRecord = {
  id: number;
  programmeName: string;
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
  pwdCount: number;
  pwdDetails: string | null;
  updatedAt: string | null;
};

export type CourseUnitEnrollmentRecord = {
  id: number;
  courseUnitName: string;
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
  pwdCount: number;
  updatedAt: string | null;
};

export function parseNonNegativeInt(value: unknown, field: string): number | { error: string } {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${field} must be a whole number zero or greater` };
  }
  return n;
}

export function parseEnrollmentCounts(body: {
  totalStudents?: unknown;
  maleCount?: unknown;
  femaleCount?: unknown;
  pwdCount?: unknown;
}):
  | { totalStudents: number; maleCount: number; femaleCount: number; pwdCount: number }
  | { error: string } {
  const totalStudents = parseNonNegativeInt(body.totalStudents, 'Total students');
  if (typeof totalStudents === 'object') return totalStudents;
  const maleCount = parseNonNegativeInt(body.maleCount, 'Male count');
  if (typeof maleCount === 'object') return maleCount;
  const femaleCount = parseNonNegativeInt(body.femaleCount, 'Female count');
  if (typeof femaleCount === 'object') return femaleCount;
  const pwdCount = parseNonNegativeInt(body.pwdCount, 'PwD count');
  if (typeof pwdCount === 'object') return pwdCount;

  if (maleCount + femaleCount > totalStudents) {
    return { error: 'Male and female counts cannot exceed total students' };
  }
  if (pwdCount > totalStudents) {
    return { error: 'PwD count cannot exceed total students' };
  }

  return { totalStudents, maleCount, femaleCount, pwdCount };
}
