import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function dashboardPathForRole(activeRole: string | undefined) {
    if (!activeRole) return null;
    const r = activeRole.trim().toLowerCase();
    if (r === 'strategy manager' || r === 'system administrator') return '/admin';
    if (r === 'department head' || r === 'unit head' || r === 'hod') return '/department-head';
    if (r === 'staff' || r === 'viewer') return '/staff';
    if (r === 'ambassador') return '/ambassador';
    return null;
}

function roleAllowedForPath(activeRole: string, allowedRoles: string[]) {
    const r = activeRole.trim().toLowerCase();
    return allowedRoles.some((a) => a.trim().toLowerCase() === r);
}

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const activeRole = request.cookies.get('active_role')?.value?.trim();

    const path = request.nextUrl.pathname;

    // Define route mappings
    const routeRequirements: Record<string, string[]> = {
        '/admin': ['Strategy Manager', 'System Administrator'],
        '/department-head': ['Department Head', 'Unit Head', 'HOD'],
        '/staff': ['Staff', 'Viewer'], // Fallbacks
        '/ambassador': ['Ambassador']
    };

    // Find if current path requires a specific role
    const matchingPrefix = Object.keys(routeRequirements).find(prefix => path.startsWith(prefix));

    if (matchingPrefix) {
        // If not logged in at all, redirect to login
        if (!token || !activeRole) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Must change temporary password before accessing any dashboard
        const mustChangePassword = request.cookies.get('must_change_password')?.value === '1';
        if (mustChangePassword && path !== '/set-password') {
            return NextResponse.redirect(new URL('/set-password', request.url));
        }

        const allowedRoles = routeRequirements[matchingPrefix];

        // If active role doesn't match the path requirements, block and redirect to their actual active role dashboard
        if (!roleAllowedForPath(activeRole, allowedRoles)) {
            const redirectPath = dashboardPathForRole(activeRole);

            // Unknown/invalid role cookie: break redirect loops by forcing logout
            if (!redirectPath) {
                const res = NextResponse.redirect(new URL('/', request.url));
                res.cookies.delete('token');
                res.cookies.delete('active_role');
                return res;
            }

            // Avoid redirecting to the same place (infinite loop)
            if (path.startsWith(redirectPath)) {
                const res = NextResponse.redirect(new URL('/', request.url));
                res.cookies.delete('token');
                res.cookies.delete('active_role');
                return res;
            }

            return NextResponse.redirect(new URL(redirectPath, request.url));
        }
    }

    // Prevent logged-in users from seeing the login page
    if (token && activeRole && path === '/') {
        const redirectPath = dashboardPathForRole(activeRole);
        if (!redirectPath) {
            const res = NextResponse.next();
            res.cookies.delete('token');
            res.cookies.delete('active_role');
            return res;
        }
        return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
