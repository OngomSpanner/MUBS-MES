import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { listEnrollmentFacultyOptions } from '@/lib/enrollment-indicators';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    const faculties = await listEnrollmentFacultyOptions();
    return NextResponse.json({ faculties });
  } catch (error: unknown) {
    console.error('enrollment/faculties GET error:', error);
    return NextResponse.json({ faculties: [] });
  }
}
