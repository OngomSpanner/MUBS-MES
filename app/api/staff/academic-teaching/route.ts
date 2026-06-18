import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAcademicYearOptions } from '@/lib/academic-year';
import { requireAcademicStaffContext } from '@/lib/academic-staff-auth';
import { listCourseUnitAssignmentsForUser } from '@/lib/academic-teaching-data';

export async function GET() {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const records = await listCourseUnitAssignmentsForUser(ctx.userId);

  return NextResponse.json({
    records,
    academicYears: getAcademicYearOptions(),
    profile: {
      staffName: ctx.staffName,
      positionDesignation: ctx.positionDesignation,
      departmentId: ctx.departmentId,
    },
  });
}

export async function POST(request: Request) {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const body = await request.json();
  const courseUnitName = String(body.courseUnitName || '').trim();
  const academicYearKey = String(body.academicYearKey || body.financialYearKey || '').trim();

  if (!courseUnitName || !academicYearKey) {
    return NextResponse.json(
      { message: 'Course unit and academic year are required' },
      { status: 400 }
    );
  }

  const status = body.submit ? 'submitted' : 'draft';

  const result = (await query({
    query: `
      INSERT INTO academic_course_unit_assignments (
        department_id, user_id, course_unit_code, course_unit_name, programme_name,
        financial_year_key, reporting_period, semester_label, student_count, teaching_hours,
        status, submitted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    values: [
      ctx.departmentId,
      ctx.userId,
      body.courseUnitCode ? String(body.courseUnitCode).trim() : null,
      courseUnitName,
      body.programmeName ? String(body.programmeName).trim() : null,
      academicYearKey,
      body.reportingPeriod ? String(body.reportingPeriod).trim() : null,
      body.semesterLabel ? String(body.semesterLabel).trim() : null,
      body.studentCount != null ? Math.max(0, Number(body.studentCount)) : null,
      body.teachingHours != null ? Math.max(0, Number(body.teachingHours)) : null,
      status,
      status === 'submitted' ? ctx.userId : null,
    ],
  })) as { insertId: number };

  return NextResponse.json({ id: result.insertId, message: 'Course unit assignment saved' }, { status: 201 });
}
