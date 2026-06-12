import { NextResponse } from 'next/server';
import { requireChangeRequestReviewer } from '@/lib/admin/change-request-access';
import {
  getChangeRequestForReview,
  isChangeRequestStatus,
  updateChangeRequestReview,
} from '@/lib/ambassador/change-requests';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireChangeRequestReviewer();
    if ('error' in ctx) return ctx.error;

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ message: 'Invalid request id' }, { status: 400 });
    }

    const request = await getChangeRequestForReview(id);
    if (!request) {
      return NextResponse.json({ message: 'Change request not found' }, { status: 404 });
    }

    return NextResponse.json({ request });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin change-requests GET [id] error:', error);
    return NextResponse.json({ message: 'Error loading change request', detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await requireChangeRequestReviewer();
    if ('error' in ctx) return ctx.error;

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ message: 'Invalid request id' }, { status: 400 });
    }

    const existing = await getChangeRequestForReview(id);
    if (!existing) {
      return NextResponse.json({ message: 'Change request not found' }, { status: 404 });
    }

    const body = await request.json();
    const status = String(body.status || '').trim();
    if (!isChangeRequestStatus(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }

    const adminNotesRaw = body.adminNotes ?? body.admin_notes;
    const adminNotes =
      adminNotesRaw == null || String(adminNotesRaw).trim() === ''
        ? null
        : String(adminNotesRaw).trim();

    const updated = await updateChangeRequestReview(id, { status, adminNotes });
    if (!updated) {
      return NextResponse.json({ message: 'Change request not found' }, { status: 404 });
    }

    const requestRow = await getChangeRequestForReview(id);
    return NextResponse.json({ message: 'Change request updated', request: requestRow });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin change-requests PATCH error:', error);
    return NextResponse.json({ message: 'Error updating change request', detail: message }, { status: 500 });
  }
}
