import type { ActivityFyTargetKey } from '@/lib/activity-fy-targets';

/** Matrix columns for admin Results Framework report (Jul–Jun FY). */
export const RF_MATRIX_BASELINE = {
  label: '2024/2025',
  actualAlias: 'actual_baseline_fy24_25',
  start: '2024-07-01',
  end: '2025-07-01',
} as const;

export const RF_MATRIX_FY_COLUMNS = [
  {
    label: '2025/2026',
    targetKey: 'target_fy25_26' as ActivityFyTargetKey,
    actualAlias: 'actual_fy25_26',
    start: '2025-07-01',
    end: '2026-07-01',
  },
  {
    label: '2026/2027',
    targetKey: 'target_fy26_27' as ActivityFyTargetKey,
    actualAlias: 'actual_fy26_27',
    start: '2026-07-01',
    end: '2027-07-01',
  },
  {
    label: '2027/2028',
    targetKey: 'target_fy27_28' as ActivityFyTargetKey,
    actualAlias: 'actual_fy27_28',
    start: '2027-07-01',
    end: '2028-07-01',
  },
  {
    label: '2028/2029',
    targetKey: 'target_fy28_29' as ActivityFyTargetKey,
    actualAlias: 'actual_fy28_29',
    start: '2028-07-01',
    end: '2029-07-01',
  },
  {
    label: '2029/2030',
    targetKey: 'target_fy29_30' as ActivityFyTargetKey,
    actualAlias: 'actual_fy29_30',
    start: '2029-07-01',
    end: '2030-07-01',
  },
] as const;

function buildActualSumSubquery(start: string, end: string, alias: string): string {
  return `(
    SELECT SUM(sr.kpi_actual_value)
    FROM staff_reports sr
    LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
    LEFT JOIN strategic_activities act_aa ON aa.activity_id = act_aa.id
    LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
    LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
    LEFT JOIN strategic_activities act_spa ON spa.activity_id = act_spa.id
    WHERE sr.kpi_actual_value IS NOT NULL
      AND sr.status IN ('submitted', 'evaluated')
      AND sr.report_date >= '${start}'
      AND sr.report_date < '${end}'
      AND (
        act_aa.id = sa.id OR act_aa.parent_id = sa.id
        OR act_spa.id = sa.id OR act_spa.parent_id = sa.id
      )
  ) AS ${alias}`;
}

export function buildResultsFrameworkMatrixActualSelect(): string {
  const baseline = buildActualSumSubquery(
    RF_MATRIX_BASELINE.start,
    RF_MATRIX_BASELINE.end,
    RF_MATRIX_BASELINE.actualAlias,
  );
  const fyActuals = RF_MATRIX_FY_COLUMNS.map((c) =>
    buildActualSumSubquery(c.start, c.end, c.actualAlias),
  );
  return [baseline, ...fyActuals].join(',\n  ');
}

export type ResultsFrameworkMatrixFyCell = {
  label: string;
  target: number | null;
  actual: number | null;
};

export type ResultsFrameworkMatrixRow = {
  id: number;
  outcomeOutput: string;
  indicator: string;
  baseline2024_25: number | null;
  fiscalYears: ResultsFrameworkMatrixFyCell[];
  budget: string | null;
  responsibleOffice: string;
  unitOfMeasure: string | null;
};

/** Map short FY key (e.g. 2025/26) to matrix column label (2025/2026). */
export function rfMatrixFyLabelFromFyKey(fyKey: string): string | null {
  const t = String(fyKey || '')
    .trim()
    .replace(/^FY\s+/i, '');
  const m = t.match(/^(\d{4})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const y1 = parseInt(m[1], 10);
  if (!Number.isFinite(y1)) return null;
  return `${y1}/${y1 + 1}`;
}
