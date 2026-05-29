import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { listFacultyStaffProfiles } from '@/lib/ambassador/faculty-staff-profiles';
import { listManagedUnitDepartments } from '@/lib/ambassador/managed-unit-departments';
import { ensureDepartmentSectionTables } from '@/lib/department-sections';

export async function GET() {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    await ensureDepartmentSectionTables();

    const [staff, departments] = await Promise.all([
      listFacultyStaffProfiles(ctx.managedUnitId),
      listManagedUnitDepartments(ctx.managedUnitId),
    ]);

    const departmentOptions = [
      'All Departments',
      ...departments.map((d) => d.displayName || d.name),
    ];

    return NextResponse.json({
      managedUnitId: ctx.managedUnitId,
      managedUnitName: ctx.managedUnitName,
      staff,
      departmentOptions,
      totalStaff: staff.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador staff profiles API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching faculty staff profiles', detail: message },
      { status: 500 }
    );
  }
}
