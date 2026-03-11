import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-123456';
function ensureJwtSecret() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-123456')) {
    throw new Error('JWT_SECRET must be set in production');
  }
}

export async function POST(request: Request) {
  try {
    ensureJwtSecret();
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json({ message: 'Missing token or new password' }, { status: 400 });
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as any;
    } catch (err) {
      return NextResponse.json({ message: 'Invalid or expired password reset link' }, { status: 400 });
    }

    if (payload.type !== 'password_reset' || !payload.email) {
      return NextResponse.json({ message: 'Invalid token type' }, { status: 400 });
    }

    // Check if user exists
    const users = await query({
      query: 'SELECT id FROM users WHERE email = ?',
      values: [payload.email]
    });

    const user = (users as any[])[0];
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update the password in db
    await query({
      query: 'UPDATE users SET password_hash = ? WHERE email = ?',
      values: [passwordHash, payload.email]
    });

    return NextResponse.json({ message: 'Password has been successfully reset' });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
