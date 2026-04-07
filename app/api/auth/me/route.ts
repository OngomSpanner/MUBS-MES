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

        // Fetch roles from user_roles table to ensure all assigned roles are captured
        try {
            const roleRows = await query({
                query: 'SELECT role FROM user_roles WHERE user_id = ?',
                values: [user.id]
            }) as any[];
            for (const r of roleRows) {
                if (r.role && !rolesArray.includes(r.role)) {
                    rolesArray.push(r.role);
                }
            }
        } catch (roleTableErr) {
            console.error('user_roles table error:', roleTableErr);
        }

        // Committee assignments (for Committee Member role) – empty if table not yet migrated
        let committees: string[] = [];
        try {
            const rows = await query({
                query: 'SELECT committee_type FROM user_committee_assignments WHERE user_id = ? ORDER BY committee_type',
                values: [user.id]
            }) as any[];
            committees = (rows || []).map((r: any) => r.committee_type).filter(Boolean);
        } catch {
            // user_committee_assignments may not exist yet
        }

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
            activeRole: activeRole,
            committees,
        });

    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
