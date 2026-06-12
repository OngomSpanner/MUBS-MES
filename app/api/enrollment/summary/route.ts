import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { summarizeEnrollmentIndicators } from '@/lib/enrollment-indicators';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    const faculty = new URL(req.url).searchParams.get('faculty');
    const summary = await summarizeEnrollmentIndicators(faculty);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('enrollment/summary GET error:', error);
    return NextResponse.json({ message: 'Error loading enrollment summary', detail: message }, { status: 500 });
  }
}
