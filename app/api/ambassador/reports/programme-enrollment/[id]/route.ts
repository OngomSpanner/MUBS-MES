import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import {
  normalizeEnrollmentFacultyName,
  parseEnrollmentCounts,
} from '@/lib/ambassador/enrollment-records';
import { ensureEnrollmentFacultyColumns } from '@/lib/enrollment-indicators';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';

async function getRecord(id: number) {
  const rows = (await query({
    query: `SELECT id, hod_review_status FROM staff_programme_enrollment WHERE id = ? LIMIT 1`,
    values: [id],
  })) as { id: number; hod_review_status: string }[];
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

  if (existing.hod_review_status === 'submitted' && !submitForReview) {
    return NextResponse.json(
      { message: 'This entry is awaiting HOD review and cannot be edited.' },
      { status: 409 }
    );
  }

  const hodStatus = hodStatusForAmbassadorSave(submitForReview);

  try {
    await ensureHodReviewWorkflowSchema();
    await query({
      query: `
        UPDATE staff_programme_enrollment
        SET faculty_name = ?, programme_name = ?, total_students = ?, male_count = ?, female_count = ?, pwd_count = ?, pwd_details = ?, hod_review_status = ?
        WHERE id = ?
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
        id,
      ],
    });
    return NextResponse.json({
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const existing = await getRecord(id);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  await query({ query: 'DELETE FROM staff_programme_enrollment WHERE id = ?', values: [id] });
  return NextResponse.json({ message: 'Programme enrollment deleted' });
}
