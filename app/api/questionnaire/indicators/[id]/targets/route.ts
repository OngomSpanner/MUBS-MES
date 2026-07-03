import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import {
  ensureIndicatorTargetsSchema,
  loadIndicatorTargets,
  saveIndicatorTargets,
  type IndicatorTargetInput,
} from '@/lib/questionnaire-metric-targets';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

/** GET: load targets for an indicator. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const indicatorId = Number(id);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) {
      return NextResponse.json({ message: 'Invalid indicator id' }, { status: 400 });
    }

    const exists = (await query({
      query: 'SELECT id FROM q_indicators WHERE id = ?',
      values: [indicatorId],
    })) as { id: number }[];
    if (!exists.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const metrics = (await query({
      query: 'SELECT id, metric_text, unit_of_measure, sort_order FROM q_metrics WHERE indicator_id = ? ORDER BY sort_order',
      values: [indicatorId],
    })) as { id: number; metric_text: string; unit_of_measure: string; sort_order: number }[];

    const financialYears = (await query({
      query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ? ORDER BY financial_year',
      values: [indicatorId],
    })) as { financial_year: string }[];

    const targets = await loadIndicatorTargets(indicatorId);

    return NextResponse.json({
      metrics: metrics.map((m) => ({ ...m, id: Number(m.id) })),
      financial_years: financialYears.map((f) => normalizeFinancialYear(f.financial_year)),
      targets,
    });
  } catch (e) {
    console.error('q_indicators targets GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

/** PUT: save targets only (for existing indicators). */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const indicatorId = Number(id);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) {
      return NextResponse.json({ message: 'Invalid indicator id' }, { status: 400 });
    }

    await ensureIndicatorTargetsSchema();
    const body = await request.json();
    const entries: IndicatorTargetInput[] = Array.isArray(body.targets) ? body.targets : [];

    const financialYears = (await query({
      query: 'SELECT financial_year FROM q_indicator_fys WHERE indicator_id = ?',
      values: [indicatorId],
    })) as { financial_year: string }[];
    if (!financialYears.length) {
      return NextResponse.json({ message: 'Indicator has no financial years configured' }, { status: 422 });
    }

    const fys = financialYears.map((f) => normalizeFinancialYear(f.financial_year));
    await saveIndicatorTargets(indicatorId, fys, entries);

    return NextResponse.json({ message: 'Targets saved' });
  } catch (e) {
    console.error('q_indicators targets PUT', e);
    return NextResponse.json({ message: 'Error saving targets' }, { status: 500 });
  }
}
