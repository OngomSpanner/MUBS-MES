import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';

export type AcademicRecordStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

type ReviewFields = {
  hodComment: string | null;
  reviewedAt: string | null;
};

export type CourseUnitAssignment = {
  id: number;
  departmentId: number;
  departmentName: string;
  userId: number;
  staffName: string;
  positionDesignation: string;
  courseUnitCode: string | null;
  courseUnitName: string;
  programmeName: string | null;
  financialYearKey: string;
  reportingPeriod: string | null;
  semesterLabel: string | null;
  studentCount: number | null;
  teachingHours: number | null;
  status: AcademicRecordStatus;
  approvedAt: string | null;
  updatedAt: string;
} & ReviewFields;

export type ProgrammeAllocation = {
  id: number;
  departmentId: number;
  departmentName: string;
  userId: number;
  staffName: string;
  positionDesignation: string;
  programmeName: string;
  allocationRole: string | null;
  financialYearKey: string;
  reportingPeriod: string | null;
  semesterLabel: string | null;
  status: AcademicRecordStatus;
  approvedAt: string | null;
  updatedAt: string;
} & ReviewFields;

export async function listCourseUnitAssignments(
  departmentIds: number[]
): Promise<CourseUnitAssignment[]> {
  if (departmentIds.length === 0) return [];
  const ph = inPlaceholders(departmentIds.length);

  const rows = (await query({
    query: `
      SELECT a.*,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS staff_name,
             COALESCE(NULLIF(TRIM(u.designation_grade), ''), NULLIF(TRIM(u.position), ''), '') AS position_designation,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM academic_course_unit_assignments a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN departments d ON d.id = a.department_id
      WHERE a.department_id IN (${ph})
      ORDER BY a.updated_at DESC, a.id DESC
    `,
    values: departmentIds,
  })) as Record<string, unknown>[];

  return rows.map(mapCourseRow);
}

function mapCourseRow(r: Record<string, unknown>): CourseUnitAssignment {
  return {
    id: Number(r.id),
    departmentId: Number(r.department_id),
    departmentName: String(r.department_name || '—'),
    userId: Number(r.user_id),
    staffName: String(r.staff_name || '').trim() || `Staff #${r.user_id}`,
    positionDesignation: String(r.position_designation || '').trim() || '—',
    courseUnitCode: r.course_unit_code ? String(r.course_unit_code) : null,
    courseUnitName: String(r.course_unit_name),
    programmeName: r.programme_name ? String(r.programme_name) : null,
    financialYearKey: String(r.financial_year_key),
    reportingPeriod: r.reporting_period ? String(r.reporting_period) : null,
    semesterLabel: r.semester_label ? String(r.semester_label) : null,
    studentCount: r.student_count != null ? Number(r.student_count) : null,
    teachingHours: r.teaching_hours != null ? Number(r.teaching_hours) : null,
    status: r.status as AcademicRecordStatus,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    hodComment: r.hod_comment ? String(r.hod_comment) : null,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    updatedAt: String(r.updated_at),
  };
}

export async function listProgrammeAllocations(
  departmentIds: number[]
): Promise<ProgrammeAllocation[]> {
  if (departmentIds.length === 0) return [];
  const ph = inPlaceholders(departmentIds.length);

  const rows = (await query({
    query: `
      SELECT a.*,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS staff_name,
             COALESCE(NULLIF(TRIM(u.designation_grade), ''), NULLIF(TRIM(u.position), ''), '') AS position_designation,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM academic_programme_allocations a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN departments d ON d.id = a.department_id
      WHERE a.department_id IN (${ph})
      ORDER BY a.updated_at DESC, a.id DESC
    `,
    values: departmentIds,
  })) as Record<string, unknown>[];

  return rows.map(mapProgrammeRow);
}

function mapProgrammeRow(r: Record<string, unknown>): ProgrammeAllocation {
  return {
    id: Number(r.id),
    departmentId: Number(r.department_id),
    departmentName: String(r.department_name || '—'),
    userId: Number(r.user_id),
    staffName: String(r.staff_name || '').trim() || `Staff #${r.user_id}`,
    positionDesignation: String(r.position_designation || '').trim() || '—',
    programmeName: String(r.programme_name),
    allocationRole: r.allocation_role ? String(r.allocation_role) : null,
    financialYearKey: String(r.financial_year_key),
    reportingPeriod: r.reporting_period ? String(r.reporting_period) : null,
    semesterLabel: r.semester_label ? String(r.semester_label) : null,
    status: r.status as AcademicRecordStatus,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    hodComment: r.hod_comment ? String(r.hod_comment) : null,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    updatedAt: String(r.updated_at),
  };
}

export async function listCourseUnitAssignmentsForUser(userId: number): Promise<CourseUnitAssignment[]> {
  const rows = (await query({
    query: `
      SELECT a.*,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS staff_name,
             COALESCE(NULLIF(TRIM(u.designation_grade), ''), NULLIF(TRIM(u.position), ''), '') AS position_designation,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM academic_course_unit_assignments a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN departments d ON d.id = a.department_id
      WHERE a.user_id = ?
      ORDER BY a.updated_at DESC, a.id DESC
    `,
    values: [userId],
  })) as Record<string, unknown>[];

  return rows.map(mapCourseRow);
}

export async function listProgrammeAllocationsForUser(userId: number): Promise<ProgrammeAllocation[]> {
  const rows = (await query({
    query: `
      SELECT a.*,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS staff_name,
             COALESCE(NULLIF(TRIM(u.designation_grade), ''), NULLIF(TRIM(u.position), ''), '') AS position_designation,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM academic_programme_allocations a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN departments d ON d.id = a.department_id
      WHERE a.user_id = ?
      ORDER BY a.updated_at DESC, a.id DESC
    `,
    values: [userId],
  })) as Record<string, unknown>[];

  return rows.map(mapProgrammeRow);
}

export async function getOwnedCourseAssignment(
  id: number,
  userId: number
): Promise<{ id: number; department_id: number; status: string } | null> {
  const rows = (await query({
    query: 'SELECT id, department_id, status FROM academic_course_unit_assignments WHERE id = ? AND user_id = ?',
    values: [id, userId],
  })) as { id: number; department_id: number; status: string }[];
  return rows[0] ?? null;
}

export async function getOwnedProgrammeAllocation(
  id: number,
  userId: number
): Promise<{ id: number; department_id: number; status: string } | null> {
  const rows = (await query({
    query: 'SELECT id, department_id, status FROM academic_programme_allocations WHERE id = ? AND user_id = ?',
    values: [id, userId],
  })) as { id: number; department_id: number; status: string }[];
  return rows[0] ?? null;
}

/** True when any user in these departments is categorised as academic staff. */
export async function hasAcademicStaffInDepartments(departmentIds: number[]): Promise<boolean> {
  if (departmentIds.length === 0) return false;
  const ph = inPlaceholders(departmentIds.length);
  const rows = (await query({
    query: `
      SELECT u.id FROM users u
      WHERE LOWER(TRIM(COALESCE(u.staff_category, ''))) = 'academic'
        AND u.department_id IN (${ph})
      LIMIT 1
    `,
    values: departmentIds,
  })) as { id: number }[];
  return rows.length > 0;
}

export async function isAcademicStaffInDepartments(
  userId: number,
  departmentIds: number[]
): Promise<boolean> {
  if (departmentIds.length === 0) return false;
  const ph = inPlaceholders(departmentIds.length);
  const rows = (await query({
    query: `
      SELECT u.id FROM users u
      WHERE u.id = ?
        AND LOWER(COALESCE(u.staff_category, '')) = 'academic'
        AND u.department_id IN (${ph})
      LIMIT 1
    `,
    values: [userId, ...departmentIds],
  })) as { id: number }[];
  return rows.length > 0;
}

export async function isDepartmentInScope(
  departmentId: number,
  departmentIds: number[]
): Promise<boolean> {
  return departmentIds.includes(departmentId);
}

/** True when staff have saved teaching data for any of the given departments. */
export async function hasAcademicTeachingDataInDepartments(
  departmentIds: number[]
): Promise<boolean> {
  if (departmentIds.length === 0) return false;
  const ph = inPlaceholders(departmentIds.length);

  try {
    const rows = (await query({
      query: `
        SELECT 1 AS ok FROM academic_course_unit_assignments WHERE department_id IN (${ph})
        UNION
        SELECT 1 FROM academic_programme_allocations WHERE department_id IN (${ph})
        LIMIT 1
      `,
      values: [...departmentIds, ...departmentIds],
    })) as { ok: number }[];
    return rows.length > 0;
  } catch {
    return false;
  }
}
