import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { parseRoles, pickDefaultActiveRole, normalizeRoleForCookie, roleMatches } from '@/lib/role-routing';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const activeRoleCookie = cookieStore.get('active_role')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // Find user
        const users = await query({
            query: 'SELECT id, full_name, email, role, status, position FROM users WHERE id = ?',
            values: [decoded.userId]
        });

        const user = (users as any[])[0];

        if (!user || user.status !== 'Active') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const rolesArray = parseRoles(user.role);

        // Determine active role: cookie (if valid) → token role (if valid) → priority pick
        // Accept both canonical ("Strategy Manager") and DB form ("strategy_manager")
        let activeRole = activeRoleCookie || decoded.role;
        const cookieValid = activeRole && (rolesArray.includes(activeRole) || roleMatches(rolesArray, activeRole));
        if (!cookieValid) {
            activeRole = pickDefaultActiveRole(rolesArray);
        } else {
            activeRole = normalizeRoleForCookie(activeRole);
        }

        return NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                position: user.position ?? null,
            },
            roles: rolesArray,
            activeRole: activeRole
        });

    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
