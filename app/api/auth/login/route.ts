import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';
import { parseRoles, pickDefaultActiveRole } from '@/lib/role-routing';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Find user
    const users = await query({
      query: 'SELECT id, full_name, email, password_hash, role, status FROM users WHERE email = ?',
      values: [email]
    });

    const user = (users as any[])[0];

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status !== 'Active') {
      return NextResponse.json(
        { message: 'Account is not active' },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
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

    // Set non-HTTP-only active_role cookie for edge middleware and client reading
    cookieStore.set({
      name: 'active_role',
      value: activeRole,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    // Remove password from response and inject active stats
    const { password_hash, ...userWithoutPassword } = user;
    const userPayload = {
      ...userWithoutPassword,
      roles: rolesArray,
      activeRole: activeRole
    };

    return NextResponse.json({
      message: 'Login successful',
      user: userPayload,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}