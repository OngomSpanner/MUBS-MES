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
  'hod',
  'unit_head',
  'staff',
  'system_admin',
  'ambassador'
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
    const rolesToExclude = ['viewer', 'department_head', 'committee_member', 'principal'];
    
    // Use a Set to track seen roles (lowercase for case-insensitive uniqueness)
    const seen = new Set<string>();
    const combined: string[] = [];

    // 1. Add assignable roles first
    for (const r of ASSIGNABLE_ROLES) {
      if (!rolesToExclude.includes(r.toLowerCase()) && !seen.has(r.toLowerCase())) {
        combined.push(r);
        seen.add(r.toLowerCase());
      }
    }

    // 2. Add roles found in DB that aren't excluded and aren't already added
    for (const r of fromDb) {
      if (r && !rolesToExclude.includes(r.toLowerCase()) && !seen.has(r.toLowerCase())) {
        combined.push(r);
        seen.add(r.toLowerCase());
      }
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
