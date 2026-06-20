import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { departmentHeadSubmissionTabScopes } from '@/lib/department-head-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const scopes = await departmentHeadSubmissionTabScopes(decoded.userId);
  return NextResponse.json(scopes);
}
