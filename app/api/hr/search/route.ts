import { NextResponse } from 'next/server';
import { requireHrmsAdmin } from '@/lib/hrms-access';
import { hrmsSearchStaff } from '@/lib/hrms/client';

export async function GET(request: Request) {
  const auth = await requireHrmsAdmin();
  if (auth instanceof NextResponse) return auth;

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await hrmsSearchStaff(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('HR search:', error);
    return NextResponse.json(
      { message: 'Could not reach HRMS', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
