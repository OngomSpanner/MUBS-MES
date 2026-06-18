import { query } from '@/lib/db';

export type AcademicReviewAction = 'approve' | 'reject' | 'resubmit';

const TABLES = {
  course: 'academic_course_unit_assignments',
  programme: 'academic_programme_allocations',
} as const;

export type AcademicRecordKind = keyof typeof TABLES;

export async function applyAcademicRecordReview(
  kind: AcademicRecordKind,
  recordId: number,
  reviewerId: number,
  action: AcademicReviewAction,
  comment: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const table = TABLES[kind];
  const rows = (await query({
    query: `SELECT id, status FROM ${table} WHERE id = ?`,
    values: [recordId],
  })) as { id: number; status: string }[];

  const row = rows[0];
  if (!row) {
    return { ok: false, status: 404, message: 'Record not found' };
  }

  if (row.status !== 'submitted') {
    return { ok: false, status: 400, message: 'Only submitted records can be reviewed' };
  }

  const trimmedComment = comment.trim().slice(0, 500);
  if ((action === 'reject' || action === 'resubmit') && !trimmedComment) {
    return { ok: false, status: 400, message: 'A comment is required for rejection or resubmit' };
  }

  if (action === 'approve') {
    await query({
      query: `
        UPDATE ${table}
        SET status = 'approved',
            hod_comment = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            approved_by = ?,
            approved_at = NOW()
        WHERE id = ?
      `,
      values: [trimmedComment || null, reviewerId, reviewerId, recordId],
    });
    return { ok: true };
  }

  if (action === 'reject') {
    await query({
      query: `
        UPDATE ${table}
        SET status = 'rejected',
            hod_comment = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            approved_by = NULL,
            approved_at = NULL
        WHERE id = ?
      `,
      values: [trimmedComment, reviewerId, recordId],
    });
    return { ok: true };
  }

  // resubmit — return to staff as draft for revision
  await query({
    query: `
      UPDATE ${table}
      SET status = 'draft',
          hod_comment = ?,
          reviewed_by = ?,
          reviewed_at = NOW(),
          approved_by = NULL,
          approved_at = NULL,
          submitted_by = NULL
      WHERE id = ?
    `,
    values: [trimmedComment, reviewerId, recordId],
  });
  return { ok: true };
}

export async function reviseRejectedRecord(
  kind: AcademicRecordKind,
  recordId: number,
  userId: number
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const table = TABLES[kind];
  const rows = (await query({
    query: `SELECT id, user_id, status FROM ${table} WHERE id = ?`,
    values: [recordId],
  })) as { id: number; user_id: number; status: string }[];

  const row = rows[0];
  if (!row || row.user_id !== userId) {
    return { ok: false, status: 404, message: 'Record not found' };
  }
  if (row.status !== 'rejected') {
    return { ok: false, status: 400, message: 'Only rejected records can be revised' };
  }

  await query({
    query: `UPDATE ${table} SET status = 'draft' WHERE id = ?`,
    values: [recordId],
  });
  return { ok: true };
}
