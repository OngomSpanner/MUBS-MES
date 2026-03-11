import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

/**
 * Returns the full list of assignable role values (user_roles.role enum).
 * Always includes all assignable roles (e.g. principal) even if no user has that role yet.
 */
const ASSIGNABLE_ROLES = [
  'strategy_manager',
  'committee_member',
  'hod',
  'staff',
  'principal',
  'system_admin'
] as const;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as any;
    if (!decoded?.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const rows = await query({
      query: 'SELECT DISTINCT role FROM user_roles ORDER BY role ASC',
      values: []
    }) as { role: string }[];

    const fromDb = rows.map((r) => r.role);
    const combined: string[] = [...ASSIGNABLE_ROLES];
    for (const r of fromDb) {
      if (r && !combined.includes(r)) combined.push(r);
    }
    combined.sort();

    return NextResponse.json({ roles: combined });
  } catch (error: any) {
    console.error('Users roles API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching roles', detail: error?.message },
      { status: 500 }
    );
  }
}
