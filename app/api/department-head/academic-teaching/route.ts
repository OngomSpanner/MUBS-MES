import { NextResponse } from 'next/server';
import { requireDepartmentHeadAcademicTeachingContext } from '@/lib/department-head-auth';
import { listCourseUnitAssignments } from '@/lib/academic-teaching-data';
import { getAcademicYearOptions } from '@/lib/academic-year';

export async function GET() {
  const ctx = await requireDepartmentHeadAcademicTeachingContext();
  if ('error' in ctx) return ctx.error;

  const records = await listCourseUnitAssignments(ctx.departmentIds);

  return NextResponse.json({
    records,
    academicYears: getAcademicYearOptions(),
  });
}
