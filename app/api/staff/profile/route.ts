import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { isAcademicTeachingStaff } from '@/lib/academic-staff-auth';

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

  const isAcademicStaff = await isAcademicTeachingStaff(decoded.userId);
  return NextResponse.json({ isAcademicStaff });
}
