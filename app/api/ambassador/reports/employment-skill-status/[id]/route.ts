import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';

async function getEntry(id: number) {
  const rows = (await query({
    query: `SELECT id FROM staff_employment_skill_status WHERE id = ? LIMIT 1`,
    values: [id],
  })) as { id: number }[];
  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  if (!(await getEntry(id))) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  const body = await request.json();
  const financialYearKey = String(body.financialYearKey || '').trim();
  const reportsProduced = Math.max(0, Number(body.reportsProduced ?? 0));
  const skillsMissing = Math.max(0, Number(body.skillsMissing ?? 0));

  if (!financialYearKey) {
    return NextResponse.json({ message: 'Financial year is required' }, { status: 400 });
  }

  try {
    await query({
      query: `
        UPDATE staff_employment_skill_status
        SET financial_year_key = ?, reports_produced = ?, skills_missing = ?
        WHERE id = ?
      `,
      values: [financialYearKey, reportsProduced, skillsMissing, id],
    });
    return NextResponse.json({ message: 'Skills assessment updated' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_employment_skill')) {
      return NextResponse.json({ message: 'Another entry already exists for this financial year' }, { status: 409 });
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

  if (!(await getEntry(id))) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  await query({
    query: 'DELETE FROM staff_employment_skill_status WHERE id = ?',
    values: [id],
  });
  return NextResponse.json({ message: 'Skills assessment deleted' });
}
