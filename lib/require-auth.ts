import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export type AuthPayload = { userId: number; role?: string };

/**
 * Use in protected API routes. Reads token from cookies and verifies it.
 * Returns the decoded payload (userId, role) or a 401 NextResponse.
 * Usage: const auth = await requireAuth(); if (auth instanceof NextResponse) return auth;
 *        const userId = auth.userId;
 */
export async function requireAuth(): Promise<AuthPayload | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }
  return { userId: decoded.userId, role: decoded.role };
}
