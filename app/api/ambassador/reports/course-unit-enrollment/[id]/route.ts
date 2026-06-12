import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import {
  normalizeEnrollmentFacultyName,
  parseEnrollmentCounts,
} from '@/lib/ambassador/enrollment-records';
import { ensureEnrollmentFacultyColumns } from '@/lib/enrollment-indicators';

async function getRecord(id: number) {
  const rows = (await query({
    query: `SELECT id FROM staff_course_unit_enrollment WHERE id = ? LIMIT 1`,
    values: [id],
  })) as { id: number }[];
  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  await ensureEnrollmentFacultyColumns();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const existing = await getRecord(id);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const body = await request.json();
  const courseUnitName = String(body.courseUnitName || '').trim();
  const facultyName = normalizeEnrollmentFacultyName(body.facultyName);
  if (!courseUnitName) {
    return NextResponse.json({ message: 'Course unit name is required' }, { status: 400 });
  }
  if (facultyName === 'Unspecified' && !String(body.facultyName || '').trim()) {
    return NextResponse.json({ message: 'Faculty / school is required' }, { status: 400 });
  }

  const counts = parseEnrollmentCounts(body);
  if ('error' in counts) {
    return NextResponse.json({ message: counts.error }, { status: 400 });
  }

  try {
    await query({
      query: `
        UPDATE staff_course_unit_enrollment
        SET faculty_name = ?, course_unit_name = ?, total_students = ?, male_count = ?, female_count = ?, pwd_count = ?
        WHERE id = ?
      `,
      values: [
        facultyName,
        courseUnitName,
        counts.totalStudents,
        counts.maleCount,
        counts.femaleCount,
        counts.pwdCount,
        id,
      ],
    });
    return NextResponse.json({ message: 'Course unit enrollment updated' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_course_unit')) {
      return NextResponse.json(
        { message: 'This course unit already exists for the selected faculty / school' },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const existing = await getRecord(id);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  await query({ query: 'DELETE FROM staff_course_unit_enrollment WHERE id = ?', values: [id] });
  return NextResponse.json({ message: 'Course unit enrollment deleted' });
}
