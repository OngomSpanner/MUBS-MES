import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const rows = await query({
            query: `
        SELECT
          (SELECT COUNT(*) FROM users) AS total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END) AS suspended,
          (SELECT COUNT(DISTINCT role) FROM user_roles) AS definedRoles
        FROM users
      `
        }) as any[];

        const r = rows[0];
        return NextResponse.json({
            total: Number(r.total ?? 0),
            active: Number(r.active ?? 0),
            suspended: Number(r.suspended ?? 0),
            definedRoles: Number(r.definedRoles ?? 0)
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return NextResponse.json({ message: 'Error fetching user stats' }, { status: 500 });
    }
}
