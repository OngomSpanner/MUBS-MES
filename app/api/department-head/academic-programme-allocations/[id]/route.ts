import { NextResponse } from 'next/server';
import { requireDepartmentHeadAcademicTeachingContext } from '@/lib/department-head-auth';
import { applyAcademicRecordReview } from '@/lib/academic-teaching-review';
import { query } from '@/lib/db';

async function getOwned(id: number, departmentIds: number[]) {
  const rows = (await query({
    query: 'SELECT id, department_id, status FROM academic_programme_allocations WHERE id = ?',
    values: [id],
  })) as { id: number; department_id: number; status: string }[];
  const row = rows[0];
  if (!row || !departmentIds.includes(row.department_id)) return null;
  return row;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireDepartmentHeadAcademicTeachingContext();
  if ('error' in ctx) return ctx.error;

  const { id } = await params;
  const rowId = Number(id);
  const row = await getOwned(rowId, ctx.departmentIds);
  if (!row) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  const body = await request.json();
  const action = body.action as 'approve' | 'reject' | 'resubmit';
  if (!['approve', 'reject', 'resubmit'].includes(action)) {
    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  }

  const result = await applyAcademicRecordReview(
    'programme',
    rowId,
    ctx.userId,
    action,
    String(body.comment ?? '')
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  const messages = {
    approve: 'Record approved',
    reject: 'Record rejected',
    resubmit: 'Returned to staff for revision',
  };
  return NextResponse.json({ message: messages[action] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireDepartmentHeadAcademicTeachingContext();
  if ('error' in ctx) return ctx.error;

  const { id } = await params;
  const rowId = Number(id);
  const row = await getOwned(rowId, ctx.departmentIds);
  if (!row) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  if (row.status === 'approved') {
    return NextResponse.json({ message: 'Approved records cannot be deleted' }, { status: 409 });
  }

  await query({
    query: 'DELETE FROM academic_programme_allocations WHERE id = ?',
    values: [rowId],
  });

  return NextResponse.json({ message: 'Deleted' });
}
