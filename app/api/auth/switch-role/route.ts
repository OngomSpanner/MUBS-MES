import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { generateToken, verifyToken } from '@/lib/auth';
import { parseRoles, roleMatches, getCanonicalRole } from '@/lib/role-routing';

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
};

export async function POST(request: Request) {
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

        const body = await request.json().catch(() => ({}));
        const newRoleInput = typeof body?.newRole === 'string' ? body.newRole.trim() : '';

        if (!newRoleInput) {
            return NextResponse.json({ message: 'New role is required' }, { status: 400 });
        }

        const users = await query({
            query: 'SELECT id, role, status FROM users WHERE id = ?',
            values: [decoded.userId]
        });

        const user = (users as any[])[0];

        if (!user || user.status !== 'Active') {
            return NextResponse.json({ message: 'Invalid user or account not active' }, { status: 403 });
        }

        const rolesArray = parseRoles(user.role);

        if (!roleMatches(rolesArray, newRoleInput)) {
            return NextResponse.json({ message: 'User does not have permission for this role' }, { status: 403 });
        }

        // Use canonical role so middleware always recognizes the cookie value
        const activeRole = getCanonicalRole(rolesArray, newRoleInput);
        const newToken = generateToken(user.id, activeRole);

        const res = NextResponse.json({
            message: 'Role switched successfully',
            activeRole,
        });

        res.cookies.set('token', newToken, { ...COOKIE_OPTS });
        res.cookies.set('active_role', activeRole, { ...COOKIE_OPTS, httpOnly: false });

        return res;

    } catch (error) {
        console.error('Role switch error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
