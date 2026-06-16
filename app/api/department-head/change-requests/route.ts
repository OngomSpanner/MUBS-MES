import { NextResponse } from 'next/server';
import { requireChangeRequestReviewer } from '@/lib/department-head/change-request-access';
import {
  isChangeRequestStatus,
  listChangeRequestsForDepartmentReview,
} from '@/lib/ambassador/change-requests';

export async function GET(request: Request) {
  try {
    const ctx = await requireChangeRequestReviewer();
    if ('error' in ctx) return ctx.error;

    const { searchParams } = new URL(request.url);
    const statusParam = String(searchParams.get('status') || '').trim();
    const statusFilter = statusParam && isChangeRequestStatus(statusParam) ? statusParam : undefined;

    const requests = await listChangeRequestsForDepartmentReview(ctx.departmentIds, statusFilter);
    return NextResponse.json({ requests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Department-head change-requests GET error:', error);
    return NextResponse.json({ message: 'Error loading change requests', detail: message }, { status: 500 });
  }
}
