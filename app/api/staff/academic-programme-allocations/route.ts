import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAcademicYearOptions } from '@/lib/academic-year';
import { requireAcademicStaffContext } from '@/lib/academic-staff-auth';
import { listProgrammeAllocationsForUser } from '@/lib/academic-teaching-data';

export async function GET() {
  const ctx = await requireAcademicStaffContext();
  if ('error' in ctx) return ctx.error;

  const records = await listProgrammeAllocationsForUser(ctx.userId);

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
  const programmeName = String(body.programmeName || '').trim();
  const academicYearKey = String(body.academicYearKey || body.financialYearKey || '').trim();

  if (!programmeName || !academicYearKey) {
    return NextResponse.json(
      { message: 'Programme and academic year are required' },
      { status: 400 }
    );
  }

  const status = body.submit ? 'submitted' : 'draft';

  const result = (await query({
    query: `
      INSERT INTO academic_programme_allocations (
        department_id, user_id, programme_name, allocation_role,
        financial_year_key, reporting_period, semester_label, status, submitted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    values: [
      ctx.departmentId,
      ctx.userId,
      programmeName,
      ctx.positionDesignation === '—' ? null : ctx.positionDesignation,
      academicYearKey,
      body.reportingPeriod ? String(body.reportingPeriod).trim() : null,
      body.semesterLabel ? String(body.semesterLabel).trim() : null,
      status,
      status === 'submitted' ? ctx.userId : null,
    ],
  })) as { insertId: number };

  return NextResponse.json({ id: result.insertId, message: 'Programme allocation saved' }, { status: 201 });
}
