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

/** Idempotent schema for admin-set targets per indicator per financial year. */
export async function ensureIndicatorTargetsSchema(): Promise<void> {
  if (schemaEnsured) return;

  if (!(await tableExists('q_indicator_fy_targets'))) {
    await query({
      query: `
        CREATE TABLE q_indicator_fy_targets (
          indicator_id INT NOT NULL,
          financial_year VARCHAR(20) NOT NULL,
          target_value TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (indicator_id, financial_year)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
      `,
    });
  }

  // One-time migration from legacy per-metric targets (if present).
  if (await tableExists('q_metric_fy_targets')) {
    await query({
      query: `
        INSERT IGNORE INTO q_indicator_fy_targets (indicator_id, financial_year, target_value)
        SELECT indicator_id, financial_year, MAX(target_value)
        FROM q_metric_fy_targets
        WHERE target_value IS NOT NULL AND TRIM(target_value) <> ''
        GROUP BY indicator_id, financial_year
      `,
    });
  }

  schemaEnsured = true;
}

/** @deprecated Use ensureIndicatorTargetsSchema */
export const ensureMetricTargetsSchema = ensureIndicatorTargetsSchema;

export type IndicatorTargetInput = {
  financial_year: string;
  target_value?: string | null;
};

export type IndicatorTargetRow = {
  financial_year: string;
  target_value: string | null;
};

/** @deprecated Use IndicatorTargetInput */
export type MetricTargetInput = IndicatorTargetInput & { metric_id?: number };

/** Load all targets for an indicator (one per financial year). */
export async function loadIndicatorTargets(indicatorId: number): Promise<IndicatorTargetRow[]> {
  await ensureIndicatorTargetsSchema();
  const rows = (await query({
    query: `SELECT financial_year, target_value
            FROM q_indicator_fy_targets WHERE indicator_id = ?`,
    values: [indicatorId],
  })) as IndicatorTargetRow[];
  return rows.map((r) => ({
    financial_year: normalizeFinancialYear(r.financial_year),
    target_value: r.target_value != null && String(r.target_value).trim() !== '' ? String(r.target_value) : null,
  }));
}

/** Upsert indicator targets; clears empty values. */
export async function saveIndicatorTargets(
  indicatorId: number,
  allowedFinancialYears: string[],
  entries: IndicatorTargetInput[],
): Promise<void> {
  await ensureIndicatorTargetsSchema();

  const allowedFys = new Set(allowedFinancialYears.map(normalizeFinancialYear));

  for (const entry of entries) {
    const fy = normalizeFinancialYear(String(entry.financial_year || '').trim());
    if (!fy || !allowedFys.has(fy)) continue;

    const value = entry.target_value != null ? String(entry.target_value).trim() : '';
    if (!value) {
      await query({
        query: 'DELETE FROM q_indicator_fy_targets WHERE indicator_id = ? AND financial_year = ?',
        values: [indicatorId, fy],
      });
      continue;
    }
    await query({
      query: `INSERT INTO q_indicator_fy_targets (indicator_id, financial_year, target_value)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE target_value = VALUES(target_value)`,
      values: [indicatorId, fy, value],
    });
  }

  if (allowedFys.size > 0) {
    const fyList = [...allowedFys];
    const fyPlaceholders = fyList.map(() => '?').join(',');
    await query({
      query: `DELETE FROM q_indicator_fy_targets
              WHERE indicator_id = ? AND financial_year NOT IN (${fyPlaceholders})`,
      values: [indicatorId, ...fyList],
    });
  }
}

export function indicatorTargetValue(
  targets: { financial_year: string; target_value: string | null }[] | undefined,
  fy: string,
): string | null {
  if (!targets?.length) return null;
  const normalized = normalizeFinancialYear(fy);
  const row = targets.find((t) => normalizeFinancialYear(t.financial_year) === normalized);
  const v = row?.target_value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

/** @deprecated Use indicatorTargetValue */
export const targetValueFor = indicatorTargetValue;
