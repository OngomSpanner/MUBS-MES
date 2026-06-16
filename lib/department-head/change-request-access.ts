import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { normalizeRoleForCookie, parseRoles } from '@/lib/role-routing';

const REVIEWER_ROLES = new Set(['HOD']);

async function userCanReviewChangeRequests(userId: number): Promise<boolean> {
  const roles = new Set<string>();

  const userRows = (await query({
    query: 'SELECT role FROM users WHERE id = ?',
    values: [userId],
  })) as { role: string | null }[];

  for (const role of parseRoles(userRows[0]?.role)) {
    roles.add(normalizeRoleForCookie(role));
  }

  try {
    const roleRows = (await query({
      query: 'SELECT role FROM user_roles WHERE user_id = ?',
      values: [userId],
    })) as { role: string }[];
    for (const row of roleRows) {
      if (row.role) roles.add(normalizeRoleForCookie(row.role));
    }
  } catch {
    // user_roles may not exist on older installs
  }

  return [...roles].some((role) => REVIEWER_ROLES.has(role));
}

export async function requireChangeRequestReviewer(): Promise<
  { userId: number; departmentIds: number[] } | { error: NextResponse }
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

  const allowed = await userCanReviewChangeRequests(decoded.userId);
  if (!allowed) {
    return {
      error: NextResponse.json(
        { message: 'Head of Department / Unit Head role required' },
        { status: 403 }
      ),
    };
  }

  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  return { userId: decoded.userId, departmentIds };
}
