import { ACTIVITY_FY_TARGET_COLUMNS, type ActivityFyTargetKey } from '@/lib/activity-fy-targets';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';

export function fyColumnKeyFromLabel(fyLabel: string): ActivityFyTargetKey | null {
  const match = String(fyLabel || '')
    .trim()
    .replace(/^FY\s+/i, '')
    .match(/^(\d{4})\/(\d{2})$/);
  if (!match) return null;
  const y1 = match[1].slice(-2);
  const y2 = match[2];
  const key = `target_fy${y1}_${y2}` as ActivityFyTargetKey;
  return ACTIVITY_FY_TARGET_COLUMNS.some((c) => c.key === key) ? key : null;
}

export function currentFyColumnKey(asOf = new Date()): ActivityFyTargetKey | null {
  return fyColumnKeyFromLabel(fyLabelForDateJulyJune(asOf));
}

export type RfActivityTargetInput = {
  target_kpi?: string | null;
  kpi_target_value?: number | string | null;
  performance_indicator?: string | null;
} & Partial<Record<ActivityFyTargetKey, number | string | null>>;

export function resolveRfPerformanceIndicator(row: RfActivityTargetInput): string | null {
  const fromStandard = String(row.performance_indicator || '').trim();
  if (fromStandard) return fromStandard;
  const legacy = String(row.target_kpi || '').trim();
  return legacy || null;
}

export function resolveRfTargetValue(
  row: RfActivityTargetInput,
  financialYearOrDate: string | Date = new Date()
): number | null {
  const fyKey =
    financialYearOrDate instanceof Date
      ? currentFyColumnKey(financialYearOrDate)
      : fyColumnKeyFromLabel(financialYearOrDate) ?? currentFyColumnKey();
  if (fyKey) {
    const raw = row[fyKey];
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  if (row.kpi_target_value != null && row.kpi_target_value !== '') {
    const n = Number(row.kpi_target_value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function activityQualifiesForResultsFramework(
  row: RfActivityTargetInput & { standard_id?: number | null; task_type?: string | null },
  financialYear?: string
): boolean {
  if (row.task_type === 'kpi_driver') return true;
  const fy = financialYear;
  if (resolveRfPerformanceIndicator(row) && resolveRfTargetValue(row, fy ?? new Date()) != null) return true;
  if (resolveRfTargetValue(row, fy ?? new Date()) != null) return true;
  if (row.standard_id && resolveRfPerformanceIndicator(row)) return true;
  return false;
}

/** FY + legacy KPI columns for Results Framework queries (activity alias `sa`). */
export const RF_ACTIVITY_FY_SELECT = ACTIVITY_FY_TARGET_COLUMNS.map((c) => `sa.${c.key}`).join(',\n  ');

export function buildResultsFrameworkKpiFilterSql(alias = 'sa', standardAlias = 'st'): string {
  const fyOr = ACTIVITY_FY_TARGET_COLUMNS.map((c) => `${alias}.${c.key} IS NOT NULL`).join('\n    OR ');
  return `(
    ${alias}.task_type = 'kpi_driver'
    OR ${alias}.kpi_target_value IS NOT NULL
    OR NULLIF(TRIM(${alias}.target_kpi), '') IS NOT NULL
    OR (${alias}.standard_id IS NOT NULL AND NULLIF(TRIM(${standardAlias}.performance_indicator), '') IS NOT NULL)
    OR ${fyOr}
  )`;
}

/** Coalesce child activity RF fields with parent for staff/HOD submission context. */
export function buildRfActivityCoalesceSelect(saAlias = 'sa', parentAlias = 'p'): string {
  return `
  COALESCE(${saAlias}.target_kpi, ${parentAlias}.target_kpi) AS target_kpi,
  COALESCE(${saAlias}.kpi_target_value, ${parentAlias}.kpi_target_value) AS kpi_target_value,
  ${ACTIVITY_FY_TARGET_COLUMNS.map((c) => `COALESCE(${saAlias}.${c.key}, ${parentAlias}.${c.key}) AS ${c.key}`).join(',\n  ')},
  st.performance_indicator
  `.trim();
}
