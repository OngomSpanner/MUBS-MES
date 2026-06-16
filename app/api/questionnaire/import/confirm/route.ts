import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

interface ImportRow {
  outcome_type: string;
  outcome_label: string;
  indicator_text: string;
  dept_names: string[];
  fin_years: string[];
  metrics: { metric_text: string; unit_of_measure: string }[];
  is_duplicate: boolean;
  has_errors: boolean;
  dept_resolved: { name: string; department_id: number | null }[];
  duplicate_action?: 'skip' | 'overwrite';
}

export async function POST(request: Request) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

    const allDepts = await query({ query: 'SELECT id, name, external_name FROM departments WHERE is_active=1', values: [] }) as any[];
    const deptByName = new Map<string, number>();
    for (const d of allDepts) {
      const canonical = (d.external_name?.trim() || d.name?.trim() || '').toLowerCase();
      deptByName.set(canonical, d.id);
      deptByName.set((d.name?.trim() || '').toLowerCase(), d.id);
    }

    let created = 0;
    let skipped = 0;
    let overwritten = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (row.has_errors) { skipped++; continue; }

      const deptIds = row.dept_names
        .map((n) => deptByName.get(n.toLowerCase()) ?? row.dept_resolved.find((d) => d.name === n)?.department_id)
        .filter((id): id is number => id != null && id > 0);

      if (deptIds.length === 0) { errors.push(`Row skipped — no valid departments: ${row.indicator_text}`); skipped++; continue; }

      // Ensure outcome exists
      let outcomeId: number | null = null;
      const existingOutcome = await query({
        query: 'SELECT id FROM q_outcomes WHERE type=? AND label=?',
        values: [row.outcome_type, row.outcome_label],
      }) as any[];
      if (existingOutcome.length > 0) {
        outcomeId = existingOutcome[0].id;
      } else {
        const res = await query({
          query: 'INSERT INTO q_outcomes (type, label) VALUES (?, ?)',
          values: [row.outcome_type, row.outcome_label],
        }) as any;
        outcomeId = res.insertId;
      }

      // Check duplicate
      const existing = await query({
        query: 'SELECT id FROM q_indicators WHERE outcome_id=? AND indicator_text=?',
        values: [outcomeId, row.indicator_text],
      }) as any[];

      if (existing.length > 0 && row.duplicate_action === 'skip') {
        skipped++;
        continue;
      }

      if (existing.length > 0 && row.duplicate_action === 'overwrite') {
        const existingId = existing[0].id;
        // delete metrics without responses, update indicator
        await query({ query: 'UPDATE q_indicators SET outcome_id=? WHERE id=?', values: [outcomeId, existingId] });
        await query({ query: 'DELETE FROM q_indicator_departments WHERE indicator_id=?', values: [existingId] });
        await query({ query: 'DELETE FROM q_indicator_fys WHERE indicator_id=?', values: [existingId] });
        // Only delete metrics with no responses
        const metricsWithNoResp = await query({
          query: 'SELECT id FROM q_metrics WHERE indicator_id=? AND id NOT IN (SELECT DISTINCT metric_id FROM q_responses WHERE indicator_id=?)',
          values: [existingId, existingId],
        }) as any[];
        for (const m of metricsWithNoResp) {
          await query({ query: 'DELETE FROM q_metrics WHERE id=?', values: [m.id] });
        }
        for (const deptId of deptIds) {
          await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [existingId, deptId] });
        }
        for (const fy of row.fin_years) {
          await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [existingId, fy] });
        }
        for (let i = 0; i < row.metrics.length; i++) {
          await query({
            query: 'INSERT INTO q_metrics (indicator_id, metric_text, unit_of_measure, sort_order) VALUES (?, ?, ?, ?)',
            values: [existingId, row.metrics[i].metric_text, row.metrics[i].unit_of_measure, i],
          });
        }
        overwritten++;
        continue;
      }

      if (existing.length > 0) {
        // no action specified — skip by default
        skipped++;
        continue;
      }

      // Create new
      const newInd = await query({
        query: 'INSERT INTO q_indicators (outcome_id, indicator_text) VALUES (?, ?)',
        values: [outcomeId, row.indicator_text],
      }) as any;
      const indicatorId = newInd.insertId;
      for (const deptId of deptIds) {
        await query({ query: 'INSERT IGNORE INTO q_indicator_departments (indicator_id, department_id) VALUES (?, ?)', values: [indicatorId, deptId] });
      }
      for (const fy of row.fin_years) {
        await query({ query: 'INSERT IGNORE INTO q_indicator_fys (indicator_id, financial_year) VALUES (?, ?)', values: [indicatorId, fy] });
      }
      for (let i = 0; i < row.metrics.length; i++) {
        await query({
          query: 'INSERT INTO q_metrics (indicator_id, metric_text, unit_of_measure, sort_order) VALUES (?, ?, ?, ?)',
          values: [indicatorId, row.metrics[i].metric_text, row.metrics[i].unit_of_measure, i],
        });
      }
      created++;
    }

    return NextResponse.json({ message: 'Import complete', created, overwritten, skipped, errors });
  } catch (e) {
    console.error('import confirm', e);
    return NextResponse.json({ message: 'Error during import' }, { status: 500 });
  }
}
