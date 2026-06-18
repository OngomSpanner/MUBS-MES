import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { listMubsProgrammes } from '@/lib/mubs-programmes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    const programmes = await listMubsProgrammes();
    return NextResponse.json({ programmes });
  } catch (error: unknown) {
    console.error('programmes GET error:', error);
    return NextResponse.json({ programmes: [] });
  }
}
