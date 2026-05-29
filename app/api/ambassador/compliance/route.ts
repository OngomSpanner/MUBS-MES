import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { getDepartmentComplianceBundle } from '@/lib/ambassador/department-compliance';

export async function GET() {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const data = await getDepartmentComplianceBundle(ctx.managedUnitId, ctx.managedUnitName);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador Compliance API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching compliance data', detail: message },
      { status: 500 }
    );
  }
}
