import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { query } from '@/lib/db';
import {
  hasAcademicStaffInDepartments,
  hasAcademicTeachingDataInDepartments,
} from '@/lib/academic-teaching-data';
import { isHrManagedUnit } from '@/lib/ambassador/hr-unit';
import { isSchoolRegistrarManagedUnit } from '@/lib/ambassador/school-registrar';

export type DepartmentHeadContext = {
  userId: number;
  departmentIds: number[];
};

export async function requireDepartmentHeadContext(): Promise<
  DepartmentHeadContext | { error: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) {
    return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  }

  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (departmentIds.length === 0) {
    return {
      error: NextResponse.json(
        { message: 'Your account is not linked to a department for academic data entry.' },
        { status: 403 }
      ),
    };
  }

  return { userId: decoded.userId, departmentIds };
}

async function departmentDisplayName(departmentId: number): Promise<string> {
  const rows = (await query({
    query: `
      SELECT COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS unit_name
      FROM departments d
      WHERE d.id = ?
      LIMIT 1
    `,
    values: [departmentId],
  })) as { unit_name: string }[];
  return String(rows[0]?.unit_name || '');
}

/** HR workforce review — same unit rules as ambassador reporting (HR directorate only). */
export async function departmentHeadHasHrWorkforceScope(departmentIds: number[]): Promise<boolean> {
  for (const id of departmentIds) {
    const name = await departmentDisplayName(id);
    if (await isHrManagedUnit(id, name)) return true;
  }
  return false;
}

/** Enrollment review — same unit rules as ambassador reporting (School Registrar only). */
export async function departmentHeadHasEnrollmentScope(departmentIds: number[]): Promise<boolean> {
  for (const id of departmentIds) {
    const name = await departmentDisplayName(id);
    if (await isSchoolRegistrarManagedUnit(id, name)) return true;
  }
  return false;
}

export async function requireDepartmentHeadAcademicTeachingContext(): Promise<
  DepartmentHeadContext | { error: NextResponse }
> {
  const ctx = await requireDepartmentHeadContext();
  if ('error' in ctx) return ctx;

  const hasScope = await hasAcademicTeachingDataInDepartments(ctx.departmentIds);
  if (!hasScope) {
    return {
      error: NextResponse.json(
        {
          message:
            'Lecturer teaching data review is not available until staff enter teaching data for your department.',
        },
        { status: 403 }
      ),
    };
  }

  return ctx;
}

export async function departmentHeadHasAcademicTeachingScope(userId: number): Promise<boolean> {
  const departmentIds = await getVisibleDepartmentIds(userId);
  if (departmentIds.length === 0) return false;
  const [hasAcademicStaff, hasTeachingData] = await Promise.all([
    hasAcademicStaffInDepartments(departmentIds),
    hasAcademicTeachingDataInDepartments(departmentIds),
  ]);
  return hasAcademicStaff || hasTeachingData;
}

export async function departmentHeadSubmissionTabScopes(userId: number): Promise<{
  hasAcademicTeachingScope: boolean;
  canManageHrWorkforce: boolean;
  canManageEnrollment: boolean;
}> {
  const departmentIds = await getVisibleDepartmentIds(userId);
  const [hasAcademicTeachingScope, canManageHrWorkforce, canManageEnrollment] = await Promise.all([
    departmentHeadHasAcademicTeachingScope(userId),
    departmentHeadHasHrWorkforceScope(departmentIds),
    departmentHeadHasEnrollmentScope(departmentIds),
  ]);
  return { hasAcademicTeachingScope, canManageHrWorkforce, canManageEnrollment };
}
