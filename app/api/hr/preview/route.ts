import { NextResponse } from 'next/server';
import { requireHrmsAdmin } from '@/lib/hrms-access';
import { hrmsFetchStaffBySearch } from '@/lib/hrms/client';
import { mapHrmsStaffToMeUser } from '@/lib/hrms/map-staff';

export async function GET(request: Request) {
  const auth = await requireHrmsAdmin();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim() || '';
  if (q.length < 3) {
    return NextResponse.json({ message: 'Query must be at least 3 characters' }, { status: 400 });
  }

  try {
    const staff = await hrmsFetchStaffBySearch(q);
    if (!staff) {
      return NextResponse.json({ message: 'No HRMS match' }, { status: 404 });
    }
    const mapped = await mapHrmsStaffToMeUser(staff);
    return NextResponse.json({ staff, mapped });
  } catch (error) {
    console.error('HR preview:', error);
    return NextResponse.json(
      { message: 'Could not reach HRMS', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
