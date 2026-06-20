import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import {
  normalizeEnrollmentFacultyName,
  parseEnrollmentCounts,
  type CourseUnitEnrollmentRecord,
} from '@/lib/ambassador/enrollment-records';
import { ensureEnrollmentFacultyColumns } from '@/lib/enrollment-indicators';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';

function mapRow(r: {
  id: number;
  faculty_name: string;
  course_unit_name: string;
  total_students: number;
  male_count: number;
  female_count: number;
  pwd_count: number;
  updated_at: string | null;
}): CourseUnitEnrollmentRecord {
  return {
    id: r.id,
    facultyName: normalizeEnrollmentFacultyName(r.faculty_name),
    courseUnitName: (r.course_unit_name || '').trim(),
    totalStudents: Number(r.total_students ?? 0),
    maleCount: Number(r.male_count ?? 0),
    femaleCount: Number(r.female_count ?? 0),
    pwdCount: Number(r.pwd_count ?? 0),
    updatedAt: r.updated_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  await ensureEnrollmentFacultyColumns();
  const facultyFilter = new URL(req.url).searchParams.get('faculty');

  try {
    const values: string[] = [];
    let facultySql = '';
    if (facultyFilter && facultyFilter !== 'all') {
      facultySql = ' WHERE faculty_name = ?';
      values.push(facultyFilter);
    }

    const rows = (await query({
      query: `
        SELECT id, faculty_name, course_unit_name, total_students, male_count, female_count, pwd_count, updated_at
        FROM staff_course_unit_enrollment
        ${facultySql}
        ORDER BY faculty_name ASC, course_unit_name ASC
      `,
      values,
    })) as Parameters<typeof mapRow>[0][];

    return NextResponse.json({ records: rows.map(mapRow) });
  } catch {
    return NextResponse.json({ records: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  await ensureEnrollmentFacultyColumns();
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

  const submitForReview = parseSubmitForReview(body);
  const hodStatus = hodStatusForAmbassadorSave(submitForReview);

  try {
    await ensureHodReviewWorkflowSchema();
    const result = (await query({
      query: `
        INSERT INTO staff_course_unit_enrollment
          (faculty_name, course_unit_name, total_students, male_count, female_count, pwd_count, hod_review_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      values: [
        facultyName,
        courseUnitName,
        counts.totalStudents,
        counts.maleCount,
        counts.femaleCount,
        counts.pwdCount,
        hodStatus,
      ],
    })) as { insertId: number };

    return NextResponse.json({
      message: submitForReview ? 'Submitted for HOD review' : 'Draft saved',
      id: result.insertId,
    }, { status: 201 });
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
