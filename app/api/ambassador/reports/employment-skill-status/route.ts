import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';
import { labelsFromFyWindow, getPastFinancialYearWindow } from '@/lib/financial-year';

function yearLabel(key: string) {
  const years = labelsFromFyWindow(getPastFinancialYearWindow(5));
  return years[key] ?? key;
}

export async function GET() {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const rows = (await query({
    query: `
      SELECT id, financial_year_key, reports_produced, skills_missing, updated_at
      FROM staff_employment_skill_status
      ORDER BY financial_year_key ASC
    `,
    values: [],
  })) as {
    id: number;
    financial_year_key: string;
    reports_produced: number;
    skills_missing: number;
    updated_at: string;
  }[];

  return NextResponse.json({
    records: rows.map((r) => ({
      id: r.id,
      financialYearKey: r.financial_year_key,
      financialYearLabel: yearLabel(r.financial_year_key),
      reportsProduced: Number(r.reports_produced ?? 0),
      skillsMissing: Number(r.skills_missing ?? 0),
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const financialYearKey = String(body.financialYearKey || '').trim();
  const reportsProduced = Math.max(0, Number(body.reportsProduced ?? 0));
  const skillsMissing = Math.max(0, Number(body.skillsMissing ?? 0));

  if (!financialYearKey) {
    return NextResponse.json({ message: 'Financial year is required' }, { status: 400 });
  }

  try {
    const result = (await query({
      query: `
        INSERT INTO staff_employment_skill_status
          (managed_unit_id, financial_year_key, reports_produced, skills_missing)
        VALUES (?, ?, ?, ?)
      `,
      values: [auth.managedUnitId, financialYearKey, reportsProduced, skillsMissing],
    })) as { insertId: number };

    return NextResponse.json({ id: result.insertId, message: 'Skills assessment saved' }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_employment_skill')) {
      return NextResponse.json(
        { message: 'An entry for this financial year already exists. Edit it instead.' },
        { status: 409 }
      );
    }
    throw e;
  }
}
