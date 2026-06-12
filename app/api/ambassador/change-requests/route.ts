import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { notifyReviewersOfNewChangeRequest } from '@/lib/ambassador/change-request-emails';
import {
  createChangeRequest,
  isChangeRequestCategory,
  listChangeRequestsForUser,
} from '@/lib/ambassador/change-requests';

export async function GET() {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const requests = await listChangeRequestsForUser(ctx.userId);
    return NextResponse.json({
      managedUnitName: ctx.managedUnitName,
      requests,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador change-requests GET error:', error);
    return NextResponse.json({ message: 'Error loading change requests', detail: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const body = await request.json();
    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();

    if (!isChangeRequestCategory(category)) {
      return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
    }
    if (!title || title.length > 255) {
      return NextResponse.json({ message: 'Title is required (max 255 characters)' }, { status: 400 });
    }
    if (!description || description.length < 10) {
      return NextResponse.json({ message: 'Please provide a description (at least 10 characters)' }, { status: 400 });
    }

    const id = await createChangeRequest({
      userId: ctx.userId,
      managedUnitId: ctx.managedUnitId,
      category,
      title,
      description,
    });

    notifyReviewersOfNewChangeRequest({
      requestId: id,
      ambassadorUserId: ctx.userId,
      managedUnitName: ctx.managedUnitName,
      category,
      title,
      description,
    }).catch((err) => {
      console.error('Change request reviewer email failed:', err);
    });

    return NextResponse.json({ message: 'Change request submitted', id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador change-requests POST error:', error);
    return NextResponse.json({ message: 'Error submitting change request', detail: message }, { status: 500 });
  }
}
