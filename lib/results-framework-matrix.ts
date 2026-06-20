import type { ActivityFyTargetKey } from '@/lib/activity-fy-targets';
import {
  buildQuestionnaireActualSubquery,
  type QuestionnaireActualOptions,
} from '@/lib/results-framework-questionnaire-actuals';

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

/** Questionnaire actuals per FY: baseline (2024/25) and each plan-year actual column. */
export function buildResultsFrameworkMatrixActualSelect(
  options: QuestionnaireActualOptions = {},
): string {
  const baseline = buildQuestionnaireActualSubquery(
    RF_MATRIX_BASELINE.label,
    RF_MATRIX_BASELINE.actualAlias,
    options,
  );
  const fyActuals = RF_MATRIX_FY_COLUMNS.map((c) =>
    buildQuestionnaireActualSubquery(c.label, c.actualAlias, options),
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
