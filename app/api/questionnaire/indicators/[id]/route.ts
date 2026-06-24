import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { fetchDepartmentsWithAmbassador } from '@/lib/departments-with-ambassador';
import {
  refreshIndicatorAssignedGroupFlags,
  syncIndicatorDepartmentGroups,
} from '@/lib/questionnaire/sync-indicator-groups';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json();

    const indicatorText = typeof body.indicator_text === 'string' ? body.indicator_text.trim() : '';
    const outcomeId = Number(body.outcome_id);
    const departmentIds: number[] = Array.isArray(body.department_ids) ? body.department_ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [];
    const financialYears: string[] = Array.isArray(body.financial_years) ? body.financial_years.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : [];
    const metrics: { id?: number; metric_text: string; unit_of_measure: string }[] = Array.isArray(body.metrics) ? body.metrics : [];

    if (!indicatorText) return NextResponse.json({ message: 'indicator_text is required' }, { status: 400 });
    if (!outcomeId) return NextResponse.json({ message: 'outcome_id is required' }, { status: 400 });
    if (departmentIds.length === 0) return NextResponse.json({ message: 'At least one department is required' }, { status: 400 });
    if (financialYears.length === 0) return NextResponse.json({ message: 'At least one financial year is required' }, { status: 400 });
    const validMetrics = metrics.filter((m) => typeof m.metric_text === 'string' && m.metric_text.trim());
    if (validMetrics.length === 0) return NextResponse.json({ message: 'At least one metric is required' }, { status: 400 });

    await query({ query: 'UPDATE q_indicators SET outcome_id=?, indicator_text=? WHERE id=?', values: [outcomeId, indicatorText, id] });

    // Replace departments and FYs (does not affect existing responses)
    await query({ query: 'DELETE FROM q_indicator_departments WHERE indicator_id=?', values: [id] });
    for (const deptId of departmentIds) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [id, deptId] });
    }
    await query({ query: 'DELETE FROM q_indicator_fys WHERE indicator_id=?', values: [id] });
    for (const fy of financialYears) {
      await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [id, fy] });
    }

    // Update metrics: keep existing by id, add new, delete removed
    const existingMetrics = await query({ query: 'SELECT id FROM q_metrics WHERE indicator_id=?', values: [id] }) as any[];
    const existingIds = new Set(existingMetrics.map((m: any) => m.id));
    const incomingIds = new Set(validMetrics.filter((m) => m.id).map((m) => m.id!));
    // Delete metrics not in the incoming list (only if no responses)
    for (const existing of existingMetrics) {
      if (!incomingIds.has(existing.id)) {
        const respCount = await query({ query: 'SELECT COUNT(*) as cnt FROM q_responses WHERE metric_id=?', values: [existing.id] }) as any[];
        if (respCount[0].cnt === 0) {
          await query({ query: 'DELETE FROM q_metrics WHERE id=?', values: [existing.id] });
        }
        // if has responses, leave the metric (orphaned from editing but data preserved)
      }
    }
    // Update or insert metrics
    for (let i = 0; i < validMetrics.length; i++) {
      const m = validMetrics[i];
      const uom = m.unit_of_measure || 'numeric';
      if (m.id && existingIds.has(m.id)) {
        await query({ query: 'UPDATE q_metrics SET metric_text=?, unit_of_measure=?, sort_order=? WHERE id=?', values: [m.metric_text.trim(), uom, i, m.id] });
      } else {
        await query({ query: 'INSERT INTO q_metrics (indicator_id, metric_text, unit_of_measure, sort_order) VALUES (?, ?, ?, ?)', values: [id, m.metric_text.trim(), uom, i] });
      }
    }

    const catalog = await fetchDepartmentsWithAmbassador(true);
    await refreshIndicatorAssignedGroupFlags(Number(id), departmentIds, catalog);
    await syncIndicatorDepartmentGroups(Number(id), catalog);

    return NextResponse.json({ message: 'Updated' });
  } catch (e) {
    console.error('q_indicators PUT', e);
    return NextResponse.json({ message: 'Error updating indicator' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const respCount = await query({ query: 'SELECT COUNT(*) as cnt FROM q_responses WHERE indicator_id=?', values: [id] }) as any[];
    const count = respCount[0].cnt as number;
    // Confirm token required when data exists
    const url = new URL(request.url);
    const confirmed = url.searchParams.get('confirmed') === '1';
    if (count > 0 && !confirmed) {
      return NextResponse.json({ message: 'Has responses', response_count: count, requires_confirmation: true }, { status: 409 });
    }
    // Delete responses first, then metrics, then junctions, then indicator
    await query({ query: 'DELETE FROM q_responses WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_metrics WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicator_departments WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicator_fys WHERE indicator_id=?', values: [id] });
    await query({ query: 'DELETE FROM q_indicators WHERE id=?', values: [id] });
    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    console.error('q_indicators DELETE', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
