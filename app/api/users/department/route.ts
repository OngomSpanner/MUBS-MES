import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // 1. First get the logged-in user's department and role
        const me = await query({
            query: 'SELECT department_id, role FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as any[];

        if (me.length === 0 || !me[0].department_id) {
            return NextResponse.json([]);
        }

        const myRole = (me[0].role || '').toLowerCase();
        const isHod = myRole === 'hod';

        // 2. Visible department users (department + units). If HOD, exclude self so they can only assign to staff.
        const deptIds = await getVisibleDepartmentIds(decoded.userId);
        if (!deptIds.length) return NextResponse.json([]);
        const placeholders = inPlaceholders(deptIds.length);

        const deptUsers = await query({
            query: `SELECT id, full_name, position FROM users WHERE department_id IN (${placeholders}) ${isHod ? 'AND id != ?' : ''} ORDER BY full_name ASC`,
            values: isHod ? [...deptIds, decoded.userId] : [...deptIds]
        }) as any[];

        return NextResponse.json(deptUsers);

    } catch (error: any) {
        console.error('Dept Users API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department users', detail: error.message },
            { status: 500 }
        );
    }
}
