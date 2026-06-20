import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import {
  normalizeEnrollmentFacultyName,
  parseEnrollmentCounts,
  type ProgrammeEnrollmentRecord,
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
  programme_name: string;
  total_students: number;
  male_count: number;
  female_count: number;
  pwd_count: number;
  pwd_details: string | null;
  updated_at: string | null;
}): ProgrammeEnrollmentRecord {
  return {
    id: r.id,
    facultyName: normalizeEnrollmentFacultyName(r.faculty_name),
    programmeName: (r.programme_name || '').trim(),
    totalStudents: Number(r.total_students ?? 0),
    maleCount: Number(r.male_count ?? 0),
    femaleCount: Number(r.female_count ?? 0),
    pwdCount: Number(r.pwd_count ?? 0),
    pwdDetails: r.pwd_details?.trim() || null,
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
        SELECT id, faculty_name, programme_name, total_students, male_count, female_count, pwd_count, pwd_details, updated_at
        FROM staff_programme_enrollment
        ${facultySql}
        ORDER BY faculty_name ASC, programme_name ASC
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
  const programmeName = String(body.programmeName || '').trim();
  const facultyName = normalizeEnrollmentFacultyName(body.facultyName);
  if (!programmeName) {
    return NextResponse.json({ message: 'Programme name is required' }, { status: 400 });
  }
  if (facultyName === 'Unspecified' && !String(body.facultyName || '').trim()) {
    return NextResponse.json({ message: 'Faculty / school is required' }, { status: 400 });
  }

  const counts = parseEnrollmentCounts(body);
  if ('error' in counts) {
    return NextResponse.json({ message: counts.error }, { status: 400 });
  }

  const pwdDetails = body.pwdDetails != null ? String(body.pwdDetails).trim() || null : null;
  const submitForReview = parseSubmitForReview(body);
  const hodStatus = hodStatusForAmbassadorSave(submitForReview);

  try {
    await ensureEnrollmentFacultyColumns();
    await ensureHodReviewWorkflowSchema();
    const result = (await query({
      query: `
        INSERT INTO staff_programme_enrollment
          (faculty_name, programme_name, total_students, male_count, female_count, pwd_count, pwd_details, hod_review_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values: [
        facultyName,
        programmeName,
        counts.totalStudents,
        counts.maleCount,
        counts.femaleCount,
        counts.pwdCount,
        pwdDetails,
        hodStatus,
      ],
    })) as { insertId: number };

    return NextResponse.json({
      id: result.insertId,
      message: submitForReview ? 'Submitted for HOD review' : 'Draft saved',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_programme')) {
      return NextResponse.json(
        { message: 'This programme already exists for the selected faculty / school' },
        { status: 409 }
      );
    }
    throw e;
  }
}
