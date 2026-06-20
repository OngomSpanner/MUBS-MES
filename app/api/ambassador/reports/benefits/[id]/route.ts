import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';
import { isSyncedStaff } from '@/lib/ambassador/faculty-staff';
import { BENEFIT_TYPES, type BenefitType } from '@/lib/hrms/staff-benefits';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';

const VALID_TYPES = new Set(BENEFIT_TYPES.map((b) => b.value));

async function getEntry(id: number) {
  const rows = (await query({
    query: `
      SELECT id, user_id, financial_year_key, benefit_type, received, hod_review_status
      FROM staff_benefit_entries WHERE id = ? LIMIT 1
    `,
    values: [id],
  })) as { id: number; user_id: number; financial_year_key: string; benefit_type: BenefitType; received: number; hod_review_status: string }[];
  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const existing = await getEntry(id);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const body = await request.json();
  const userId = body.userId != null ? Number(body.userId) : existing.user_id;
  const financialYearKey = body.financialYearKey != null ? String(body.financialYearKey).trim() : existing.financial_year_key;
  const benefitType = (body.benefitType != null ? String(body.benefitType).trim() : existing.benefit_type) as BenefitType;
  const received = body.received !== undefined ? (body.received !== false ? 1 : 0) : existing.received;
  const submitForReview = parseSubmitForReview(body);

  if (existing.hod_review_status === 'submitted' && !submitForReview) {
    return NextResponse.json(
      { message: 'This entry is awaiting HOD review and cannot be edited.' },
      { status: 409 }
    );
  }

  const hodStatus = hodStatusForAmbassadorSave(submitForReview);

  if (!VALID_TYPES.has(benefitType)) {
    return NextResponse.json({ message: 'Invalid benefit type' }, { status: 400 });
  }

  if (!(await isSyncedStaff(userId))) {
    return NextResponse.json({ message: 'Staff member is not HR-synced in M&E' }, { status: 403 });
  }

  try {
    await ensureHodReviewWorkflowSchema();
    await query({
      query: `
        UPDATE staff_benefit_entries
        SET user_id = ?, financial_year_key = ?, benefit_type = ?, received = ?, hod_review_status = ?
        WHERE id = ?
      `,
      values: [userId, financialYearKey, benefitType, received, hodStatus, id],
    });
    return NextResponse.json({
      message: submitForReview ? 'Submitted for HOD review' : 'Draft saved',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_staff_benefit')) {
      return NextResponse.json(
        { message: 'This staff member already has this benefit recorded for that year' },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const existing = await getEntry(id);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  await query({ query: 'DELETE FROM staff_benefit_entries WHERE id = ?', values: [id] });
  return NextResponse.json({ message: 'Benefit entry deleted' });
}
