import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { OAuth2Client } from 'google-auth-library';
import { parseRoles, pickDefaultActiveRole } from '@/lib/role-routing';

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json({ message: 'Missing credential string' }, { status: 400 });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return NextResponse.json({ message: 'Invalid Google Token Payload' }, { status: 400 });
    }

    const email = payload.email;

    // Restrict sign-in to @mubs.ac.ug domain
    if (!email.toLowerCase().endsWith('@mubs.ac.ug')) {
      return NextResponse.json(
        { message: 'Only MUBS Email accounts are permitted to sign in.' },
        { status: 403 }
      );
    }

    // Find user
    const users = await query({
      query: 'SELECT id, full_name, email, role, status FROM users WHERE email = ?',
      values: [email]
    });

    const user = (users as any[])[0];

    if (!user) {
      return NextResponse.json(
        { message: 'Email not registered in the system. Please contact the administrator.' },
        { status: 401 }
      );
    }

    if (user.status !== 'Active') {
      return NextResponse.json(
        { message: 'Account is not active' },
        { status: 403 }
      );
    }

    // Handle multiple roles (comma separated)
    const rolesArray = parseRoles(user.role);
    const activeRole = pickDefaultActiveRole(rolesArray);

    // Generate token with active role and all available roles
    const token = generateToken(user.id, activeRole);

    // Set HTTP-only cookie for secure token
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    cookieStore.set({
      name: 'active_role',
      value: activeRole,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    const userPayload = {
      ...user,
      roles: rolesArray,
      activeRole: activeRole
    };

    return NextResponse.json({
      message: 'Google login successful',
      user: userPayload,
      token
    });

  } catch (error) {
    console.error('Google Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error during Google login' },
      { status: 500 }
    );
  }
}
