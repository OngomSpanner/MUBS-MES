import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';

async function getOwned(id: number, managedUnitId: number) {
  const rows = (await query({
    query: `SELECT id FROM staff_employment_skill_status WHERE id = ? AND managed_unit_id = ? LIMIT 1`,
    values: [id, managedUnitId],
  })) as { id: number }[];
  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  if (!(await getOwned(id, auth.managedUnitId))) {
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
        WHERE id = ? AND managed_unit_id = ?
      `,
      values: [financialYearKey, reportsProduced, skillsMissing, id, auth.managedUnitId],
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
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  if (!(await getOwned(id, auth.managedUnitId))) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  await query({
    query: 'DELETE FROM staff_employment_skill_status WHERE id = ? AND managed_unit_id = ?',
    values: [id, auth.managedUnitId],
  });
  return NextResponse.json({ message: 'Skills assessment deleted' });
}
