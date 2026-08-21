import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import {
  deleteResultFormula,
  ensureResultFormulasSchema,
  insertResultFormula,
  parseResultOperation,
  type ResultFormulaOperand,
} from '@/lib/questionnaire/result-formulas';

export const dynamic = 'force-dynamic';

async function requireStrategyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

function parseOperands(raw: unknown): ResultFormulaOperand[] {
  if (!Array.isArray(raw)) return [];
  const out: ResultFormulaOperand[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const indicatorId = Number((row as ResultFormulaOperand).indicatorId);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) continue;
    const metricRaw = (row as ResultFormulaOperand).metricId;
    const metricId = metricRaw == null ? null : Number(metricRaw);
    out.push({
      indicatorId,
      metricId: metricId != null && Number.isFinite(metricId) && metricId > 0 ? metricId : null,
    });
  }
  return out;
}

export async function POST(request: Request) {
  try {
    if (!(await requireStrategyAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    await ensureResultFormulasSchema();

    const body = await request.json();
    const name = String(body.name || '').trim();
    const operation = parseResultOperation(body.operation);
    const operands = parseOperands(body.operands);
    const compareRaw = body.compareIndicatorId ?? body.compare_indicator_id;
    const compareIndicatorId =
      compareRaw == null || compareRaw === '' ? null : Number(compareRaw);

    if (!name) return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    if (!operation) return NextResponse.json({ message: 'Select a formula type' }, { status: 400 });
    if (operands.length < 1) {
      return NextResponse.json({ message: 'Select at least one indicator or metric' }, { status: 400 });
    }
    if (['divide', 'percent', 'share', 'ratio'].includes(operation) && operands.length < 2) {
      return NextResponse.json({ message: 'This formula needs two inputs (A and B)' }, { status: 400 });
    }

    const id = await insertResultFormula({
      name,
      operation,
      operands,
      compareIndicatorId: compareIndicatorId != null && Number.isFinite(compareIndicatorId) ? compareIndicatorId : null,
    });
    return NextResponse.json({ id, message: 'Formula saved' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error saving formula', detail: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireStrategyAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    await deleteResultFormula(id);
    return NextResponse.json({ message: 'Formula removed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error deleting formula', detail: message }, { status: 500 });
  }
}
