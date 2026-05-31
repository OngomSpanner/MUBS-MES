import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export type AmbassadorContext = {
  userId: number;
  managedUnitId: number;
  managedUnitName: string;
};

export async function requireAmbassador(): Promise<AmbassadorContext | { error: NextResponse }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) {
    return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  }

  const rows = (await query({
    query: `SELECT u.managed_unit_id, d.name AS unit_name
            FROM users u
            LEFT JOIN departments d ON d.id = u.managed_unit_id
            WHERE u.id = ?`,
    values: [decoded.userId],
  })) as { managed_unit_id: number | null; unit_name: string | null }[];

  if (!rows.length) {
    return { error: NextResponse.json({ message: 'User not found' }, { status: 404 }) };
  }

  const managedUnitId = rows[0].managed_unit_id;
  if (!managedUnitId) {
    return {
      error: NextResponse.json(
        { message: 'Ambassador is not assigned to a department or unit' },
        { status: 403 }
      ),
    };
  }

  return {
    userId: decoded.userId,
    managedUnitId,
    managedUnitName: rows[0].unit_name || 'Unknown Department/Unit',
  };
}
