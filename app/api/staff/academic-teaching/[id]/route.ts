import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAcademicStaffContext } from '@/lib/academic-staff-auth';
import { getOwnedCourseAssignment } from '@/lib/academic-teaching-data';
import { reviseRejectedRecord } from '@/lib/academic-teaching-review';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const { id } = await params;
  const rowId = Number(id);
  const row = await getOwnedCourseAssignment(rowId, ctx.userId);
  if (!row) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  if (row.status === 'approved') {
    return NextResponse.json({ message: 'Approved records cannot be edited' }, { status: 409 });
  }

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  const setField = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val);
  };

  if (body.courseUnitName != null) setField('course_unit_name', String(body.courseUnitName).trim());
  if (body.courseUnitCode != null) setField('course_unit_code', String(body.courseUnitCode).trim() || null);
  if (body.programmeName != null) setField('programme_name', String(body.programmeName).trim() || null);
  if (body.academicYearKey != null || body.financialYearKey != null) {
    setField('financial_year_key', String(body.academicYearKey ?? body.financialYearKey).trim());
  }
  if (body.reportingPeriod != null) setField('reporting_period', String(body.reportingPeriod).trim() || null);
  if (body.semesterLabel != null) setField('semester_label', String(body.semesterLabel).trim() || null);
  if (body.studentCount != null) setField('student_count', Math.max(0, Number(body.studentCount)));
  if (body.teachingHours != null) setField('teaching_hours', Math.max(0, Number(body.teachingHours)));

  if (body.submit === true) {
    setField('status', 'submitted');
    setField('submitted_by', ctx.userId);
  }

  if (fields.length === 0) {
    return NextResponse.json({ message: 'No changes' }, { status: 400 });
  }

  values.push(rowId);
  await query({
    query: `UPDATE academic_course_unit_assignments SET ${fields.join(', ')} WHERE id = ?`,
    values,
  });

  return NextResponse.json({ message: 'Updated' });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const { id } = await params;
  const rowId = Number(id);
  const row = await getOwnedCourseAssignment(rowId, ctx.userId);
  if (!row) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  if (row.status === 'approved') {
    return NextResponse.json({ message: 'Approved records cannot be deleted' }, { status: 409 });
  }

  await query({
    query: 'DELETE FROM academic_course_unit_assignments WHERE id = ?',
    values: [rowId],
  });

  return NextResponse.json({ message: 'Deleted' });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const { id } = await params;
  const rowId = Number(id);
  const body = await request.json();

  if (body.action === 'revise') {
    const result = await reviseRejectedRecord('course', rowId, ctx.userId);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    return NextResponse.json({ message: 'Record reopened for revision' });
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
}
