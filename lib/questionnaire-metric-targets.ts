import { query } from '@/lib/db';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';

let schemaEnsured = false;

async function tableExists(table: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    values: [table],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

/** Idempotent schema for admin-set targets per metric per financial year. */
export async function ensureMetricTargetsSchema(): Promise<void> {
  if (schemaEnsured) return;

  if (!(await tableExists('q_metric_fy_targets'))) {
    await query({
      query: `
        CREATE TABLE q_metric_fy_targets (
          metric_id INT NOT NULL,
          financial_year VARCHAR(20) NOT NULL,
          indicator_id INT NOT NULL,
          target_value TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (metric_id, financial_year),
          KEY idx_qmft_indicator (indicator_id)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
      `,
    });
  }

  schemaEnsured = true;
}

export type MetricTargetInput = {
  metric_id: number;
  financial_year: string;
  target_value?: string | null;
};

export type MetricTargetRow = {
  metric_id: number;
  financial_year: string;
  target_value: string | null;
};

/** Load all targets for an indicator. */
export async function loadIndicatorTargets(indicatorId: number): Promise<MetricTargetRow[]> {
  await ensureMetricTargetsSchema();
  const rows = (await query({
    query: `SELECT metric_id, financial_year, target_value
            FROM q_metric_fy_targets WHERE indicator_id = ?`,
    values: [indicatorId],
  })) as MetricTargetRow[];
  return rows.map((r) => ({
    metric_id: Number(r.metric_id),
    financial_year: normalizeFinancialYear(r.financial_year),
    target_value: r.target_value != null && String(r.target_value).trim() !== '' ? String(r.target_value) : null,
  }));
}

/** Attach targets array to each metric object. */
export function attachTargetsToMetrics<T extends { id: number }>(
  metrics: T[],
  targets: MetricTargetRow[],
): (T & { targets: { financial_year: string; target_value: string | null }[] })[] {
  const byMetric = new Map<number, { financial_year: string; target_value: string | null }[]>();
  for (const t of targets) {
    const list = byMetric.get(t.metric_id) ?? [];
    list.push({ financial_year: t.financial_year, target_value: t.target_value });
    byMetric.set(t.metric_id, list);
  }
  return metrics.map((m) => ({
    ...m,
    targets: byMetric.get(m.id) ?? [],
  }));
}

/** Upsert targets for metrics on an indicator; clears empty values. */
export async function saveIndicatorTargets(
  indicatorId: number,
  allowedFinancialYears: string[],
  entries: MetricTargetInput[],
): Promise<void> {
  await ensureMetricTargetsSchema();

  const allowedFys = new Set(allowedFinancialYears.map(normalizeFinancialYear));
  const validMetrics = (await query({
    query: 'SELECT id FROM q_metrics WHERE indicator_id = ?',
    values: [indicatorId],
  })) as { id: number }[];
  const validMetricIds = new Set(validMetrics.map((m) => m.id));

  const touchedMetricIds = new Set<number>();

  for (const entry of entries) {
    const metricId = Number(entry.metric_id);
    const fy = normalizeFinancialYear(String(entry.financial_year || '').trim());
    if (!metricId || !fy || !validMetricIds.has(metricId) || !allowedFys.has(fy)) continue;

    touchedMetricIds.add(metricId);
    const value = entry.target_value != null ? String(entry.target_value).trim() : '';
    if (!value) {
      await query({
        query: 'DELETE FROM q_metric_fy_targets WHERE metric_id = ? AND financial_year = ?',
        values: [metricId, fy],
      });
      continue;
    }
    await query({
      query: `INSERT INTO q_metric_fy_targets (metric_id, financial_year, indicator_id, target_value)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE target_value = VALUES(target_value), indicator_id = VALUES(indicator_id)`,
      values: [metricId, fy, indicatorId, value],
    });
  }

  // Remove targets for FYs no longer on the indicator
  if (allowedFys.size > 0) {
    const fyList = [...allowedFys];
    const fyPlaceholders = fyList.map(() => '?').join(',');
    await query({
      query: `DELETE FROM q_metric_fy_targets
              WHERE indicator_id = ? AND financial_year NOT IN (${fyPlaceholders})`,
      values: [indicatorId, ...fyList],
    });
  }
}

export function targetValueFor(
  targets: { financial_year: string; target_value: string | null }[] | undefined,
  fy: string,
): string | null {
  if (!targets?.length) return null;
  const normalized = normalizeFinancialYear(fy);
  const row = targets.find((t) => normalizeFinancialYear(t.financial_year) === normalized);
  const v = row?.target_value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}
