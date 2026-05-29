import { NextRequest, NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import {
  getDepartmentActivitiesForAmbassador,
  listAllManagedUnitActivities,
} from '@/lib/ambassador/department-compliance';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const all = request.nextUrl.searchParams.get('all') === 'true';
    if (all) {
      const activities = await listAllManagedUnitActivities(ctx.managedUnitId);
      return NextResponse.json({ activities });
    }

    const departmentId = Number(request.nextUrl.searchParams.get('departmentId'));
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      return NextResponse.json({ message: 'departmentId is required' }, { status: 400 });
    }

    const data = await getDepartmentActivitiesForAmbassador(ctx.managedUnitId, departmentId);
    if (!data) {
      return NextResponse.json({ message: 'Department not found in your faculty' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador department activities API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching department activities', detail: message },
      { status: 500 }
    );
  }
}
