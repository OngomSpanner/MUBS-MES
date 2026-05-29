import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import { parseEnrollmentCounts, type CourseUnitEnrollmentRecord } from '@/lib/ambassador/enrollment-records';

function mapRow(r: {
  id: number;
  course_unit_name: string;
  total_students: number;
  male_count: number;
  female_count: number;
  pwd_count: number;
  updated_at: string | null;
}): CourseUnitEnrollmentRecord {
  return {
    id: r.id,
    courseUnitName: (r.course_unit_name || '').trim(),
    totalStudents: Number(r.total_students ?? 0),
    maleCount: Number(r.male_count ?? 0),
    femaleCount: Number(r.female_count ?? 0),
    pwdCount: Number(r.pwd_count ?? 0),
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  try {
    const rows = (await query({
      query: `
        SELECT id, course_unit_name, total_students, male_count, female_count, pwd_count, updated_at
        FROM staff_course_unit_enrollment
        ORDER BY course_unit_name ASC
      `,
      values: [],
    })) as Parameters<typeof mapRow>[0][];

    return NextResponse.json({ records: rows.map(mapRow) });
  } catch {
    return NextResponse.json({ records: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const courseUnitName = String(body.courseUnitName || '').trim();
  if (!courseUnitName) {
    return NextResponse.json({ message: 'Course unit name is required' }, { status: 400 });
  }

  const counts = parseEnrollmentCounts(body);
  if ('error' in counts) {
    return NextResponse.json({ message: counts.error }, { status: 400 });
  }

  try {
    const result = (await query({
      query: `
        INSERT INTO staff_course_unit_enrollment
          (course_unit_name, total_students, male_count, female_count, pwd_count)
        VALUES (?, ?, ?, ?, ?)
      `,
      values: [
        courseUnitName,
        counts.totalStudents,
        counts.maleCount,
        counts.femaleCount,
        counts.pwdCount,
      ],
    })) as { insertId: number };

    return NextResponse.json({ message: 'Course unit enrollment saved', id: result.insertId }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_course_unit_enrollment')) {
      return NextResponse.json({ message: 'This course unit already exists' }, { status: 409 });
    }
    throw e;
  }
}
