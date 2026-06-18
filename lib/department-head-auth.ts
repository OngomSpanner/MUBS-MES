import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { hasAcademicTeachingDataInDepartments } from '@/lib/academic-teaching-data';

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
            'Academic teaching review is not available until staff enter teaching data for your department.',
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
  return hasAcademicTeachingDataInDepartments(departmentIds);
}
