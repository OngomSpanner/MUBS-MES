import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';
import { labelsFromFyWindow, getPastFinancialYearWindow } from '@/lib/financial-year';
import {
  ensureHodReviewWorkflowSchema,
  hodStatusForAmbassadorSave,
  parseSubmitForReview,
} from '@/lib/hod-review-workflow';

function yearLabel(key: string) {
  const years = labelsFromFyWindow(getPastFinancialYearWindow(5));
  return years[key] ?? key;
}

export async function GET() {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const rows = (await query({
    query: `
      SELECT id, assessment_detail, financial_year_key, count_value, updated_at
      FROM staff_workforce_assessment_counts
      ORDER BY assessment_detail ASC, financial_year_key ASC
    `,
    values: [],
  })) as {
    id: number;
    assessment_detail: string;
    financial_year_key: string;
    count_value: number;
    updated_at: string;
  }[];

  return NextResponse.json({
    records: rows.map((r) => ({
      id: r.id,
      assessmentDetail: r.assessment_detail,
      financialYearKey: r.financial_year_key,
      financialYearLabel: yearLabel(r.financial_year_key),
      countValue: Number(r.count_value ?? 0),
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const assessmentDetail = String(body.assessmentDetail || '').trim();
  const financialYearKey = String(body.financialYearKey || '').trim();
  const countValue = Math.max(0, Number(body.countValue ?? 0));
  const submitForReview = parseSubmitForReview(body);
  const hodStatus = hodStatusForAmbassadorSave(submitForReview);

  if (!assessmentDetail || !financialYearKey) {
    return NextResponse.json({ message: 'Assessment detail and financial year are required' }, { status: 400 });
  }

  try {
    await ensureHodReviewWorkflowSchema();
    const result = (await query({
      query: `
        INSERT INTO staff_workforce_assessment_counts
          (managed_unit_id, assessment_detail, financial_year_key, count_value, hod_review_status)
        VALUES (?, ?, ?, ?, ?)
      `,
      values: [auth.managedUnitId, assessmentDetail, financialYearKey, countValue, hodStatus],
    })) as { insertId: number };

    return NextResponse.json({
      id: result.insertId,
      message: submitForReview ? 'Submitted for HOD review' : 'Draft saved',
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_workforce')) {
      return NextResponse.json(
        { message: 'An entry for this assessment and year already exists. Edit it instead.' },
        { status: 409 }
      );
    }
    throw e;
  }
}
