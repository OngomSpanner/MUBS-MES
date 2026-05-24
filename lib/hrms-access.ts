import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export type AuthUser = { userId: number; role: string };

export async function requireHrmsAdmin(): Promise<AuthUser | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const roles = String(decoded.role || '')
    .split(',')
    .map((r) => r.trim().toLowerCase().replace(/\s+/g, '_'));

  const allowed =
    roles.includes('system_admin') ||
    roles.includes('system_administrator') ||
    roles.includes('strategy_manager');

  if (!allowed) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  return { userId: decoded.userId, role: decoded.role || '' };
}
