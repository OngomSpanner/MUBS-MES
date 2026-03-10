import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const activeRole = request.cookies.get('active_role')?.value;

    const path = request.nextUrl.pathname;

    // Define route mappings
    const routeRequirements: Record<string, string[]> = {
        '/admin': ['Strategy Manager', 'System Administrator'],
        '/comm': ['Committee Member'],
        '/principal': ['Principal'],
        '/unit-head': ['Unit Head', 'HOD'],
        '/staff': ['Staff', 'Viewer'] // Fallbacks
    };

    // Find if current path requires a specific role
    const matchingPrefix = Object.keys(routeRequirements).find(prefix => path.startsWith(prefix));

    if (matchingPrefix) {
        // If not logged in at all, redirect to login
        if (!token || !activeRole) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        const allowedRoles = routeRequirements[matchingPrefix];

        // If active role doesn't match the path requirements, block and redirect to their actual active role dashboard
        if (!allowedRoles.includes(activeRole)) {
            let redirectPath = '/staff'; // Default fallback
            if (activeRole === 'Strategy Manager' || activeRole === 'System Administrator') redirectPath = '/admin';
            else if (activeRole === 'Committee Member') redirectPath = '/comm';
            else if (activeRole === 'Principal') redirectPath = '/principal';
            else if (activeRole === 'Unit Head' || activeRole === 'HOD') redirectPath = '/unit-head';

            return NextResponse.redirect(new URL(redirectPath, request.url));
        }
    }

    // Prevent logged-in users from seeing the login page
    if (token && activeRole && path === '/') {
        let redirectPath = '/staff'; // Default fallback
        if (activeRole === 'Strategy Manager' || activeRole === 'System Administrator') redirectPath = '/admin';
        else if (activeRole === 'Committee Member') redirectPath = '/comm';
        else if (activeRole === 'Principal') redirectPath = '/principal';
        else if (activeRole === 'Unit Head' || activeRole === 'HOD') redirectPath = '/unit-head';

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
