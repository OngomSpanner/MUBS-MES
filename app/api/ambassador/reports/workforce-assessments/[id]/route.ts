import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';

async function getEntry(id: number) {
  const rows = (await query({
    query: `SELECT id FROM staff_workforce_assessment_counts WHERE id = ? LIMIT 1`,
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
  const assessmentDetail = String(body.assessmentDetail || '').trim();
  const financialYearKey = String(body.financialYearKey || '').trim();
  const countValue = Math.max(0, Number(body.countValue ?? 0));

  if (!assessmentDetail || !financialYearKey) {
    return NextResponse.json({ message: 'Assessment detail and financial year are required' }, { status: 400 });
  }

  try {
    await query({
      query: `
        UPDATE staff_workforce_assessment_counts
        SET assessment_detail = ?, financial_year_key = ?, count_value = ?
        WHERE id = ?
      `,
      values: [assessmentDetail, financialYearKey, countValue, id],
    });
    return NextResponse.json({ message: 'Workforce assessment updated' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_workforce')) {
      return NextResponse.json(
        { message: 'Another entry already uses this assessment and year combination' },
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

  if (!(await getEntry(id))) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  }

  await query({
    query: 'DELETE FROM staff_workforce_assessment_counts WHERE id = ?',
    values: [id],
  });
  return NextResponse.json({ message: 'Workforce assessment deleted' });
}
