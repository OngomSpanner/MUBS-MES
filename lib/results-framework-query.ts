import {
  PERFORMANCE_STATUS_LABELS,
  PRACTICE_TYPE_LABELS,
  computePerformanceStatus,
  type PerformanceStatus,
  type PracticeType,
} from '@/lib/results-framework';
import {
  activityQualifiesForResultsFramework,
  activityQualifiesForResultsFrameworkMatrix,
  resolveRfPerformanceIndicator,
  RF_ACTIVITY_FY_SELECT,
  buildResultsFrameworkKpiFilterSql,
  resolveRfTargetValue,
  type RfActivityTargetInput,
} from '@/lib/rf-activity-targets';
import type { ActivityFyTargetKey } from '@/lib/activity-fy-targets';
import { fyRangeJulyJune } from '@/lib/financial-year';
import {
  RF_MATRIX_BASELINE,
  RF_MATRIX_FY_COLUMNS,
  buildResultsFrameworkMatrixActualSelect,
  rfMatrixFyLabelFromFyKey,
  type ResultsFrameworkMatrixFyCell,
  type ResultsFrameworkMatrixRow,
} from '@/lib/results-framework-matrix';
export type ResultsFrameworkDbRow = {
  id: number;
  title: string;
  target_kpi: string | null;
  kpi_target_value: number | null;
  actual_value: number | null;
  unit_of_measure: string | null;
  standard_title: string | null;
  quality_standard: string | null;
  output_standard: string | null;
  performance_indicator: string | null;
  standard_id: number | null;
  task_type: string | null;
  department_name: string | null;
  ambassador_outcome_reason?: string | null;
  ambassador_practice_type?: PracticeType | null;
  staff_outcome_reason?: string | null;
  staff_practice_type?: PracticeType | null;
} & Partial<Record<ActivityFyTargetKey, number | null>> & {
  actual_baseline_fy24_25?: number | null;
  actual_fy25_26?: number | null;
  actual_fy26_27?: number | null;
  actual_fy27_28?: number | null;
  actual_fy28_29?: number | null;
  actual_fy29_30?: number | null;
};

export type ResultsFrameworkSummary = {
  total: number;
  assessed: number;
  notAssessed: number;
  underperformance: number;
  achievement: number;
  overachievement: number;
  narrativesRecorded: number;
  /** Assessed indicators requiring an ambassador narrative. */
  narrativesRequired: number;
  narrativesMissing: number;
  narrativesComplete: number;
};

const RF_KPI_ACTUAL_SUBQUERY = `
  (
    SELECT SUM(sr.kpi_actual_value)
    FROM staff_reports sr
    LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
    LEFT JOIN strategic_activities act_aa ON aa.activity_id = act_aa.id
    LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
    LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
    LEFT JOIN strategic_activities act_spa ON spa.activity_id = act_spa.id
    WHERE sr.kpi_actual_value IS NOT NULL
      AND sr.status IN ('submitted', 'evaluated')
      AND (
        act_aa.id = sa.id OR act_aa.parent_id = sa.id
        OR act_spa.id = sa.id OR act_spa.parent_id = sa.id
      )
  )
`;

/** Prefer staff KPI sum over stored actual_value (rollup may be stale). */
export const RF_ACTIVITY_ACTUAL_SELECT = `
  COALESCE(
    ${RF_KPI_ACTUAL_SUBQUERY},
    sa.actual_value
  ) AS actual_value
`;

const STAFF_NARRATIVE_SUBQUERY = `
  (
    SELECT sr.outcome_reason
    FROM staff_reports sr
    LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
    LEFT JOIN strategic_activities act_aa ON aa.activity_id = act_aa.id
    LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
    LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
    LEFT JOIN strategic_activities act_spa ON spa.activity_id = act_spa.id
    WHERE sr.outcome_reason IS NOT NULL AND TRIM(sr.outcome_reason) <> ''
      AND sr.status IN ('submitted', 'evaluated')
      AND (act_aa.id = sa.id OR act_aa.parent_id = sa.id OR act_spa.id = sa.id OR act_spa.parent_id = sa.id)
    ORDER BY sr.updated_at DESC
    LIMIT 1
  ) AS staff_outcome_reason,
  (
    SELECT sr.practice_type
    FROM staff_reports sr
    LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
    LEFT JOIN strategic_activities act_aa ON aa.activity_id = act_aa.id
    LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
    LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
    LEFT JOIN strategic_activities act_spa ON spa.activity_id = act_spa.id
    WHERE sr.practice_type IS NOT NULL
      AND sr.status IN ('submitted', 'evaluated')
      AND (act_aa.id = sa.id OR act_aa.parent_id = sa.id OR act_spa.id = sa.id OR act_spa.parent_id = sa.id)
    ORDER BY sr.updated_at DESC
    LIMIT 1
  ) AS staff_practice_type
`;

export function buildResultsFrameworkActivitySelect(financialYearKey: string): string {
  return `
  sa.id,
  sa.title,
  sa.target_kpi,
  sa.kpi_target_value,
  ${RF_ACTIVITY_ACTUAL_SELECT},
  sa.unit_of_measure,
  sa.standard_id,
  sa.task_type,
  ${RF_ACTIVITY_FY_SELECT},
  st.title AS standard_title,
  st.quality_standard,
  st.output_standard,
  st.performance_indicator,
  COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name,
  arn.outcome_reason AS ambassador_outcome_reason,
  arn.practice_type AS ambassador_practice_type,
  ${STAFF_NARRATIVE_SUBQUERY}
  `;
}

export function buildResultsFrameworkMatrixActivitySelect(): string {
  return `
  sa.id,
  sa.title,
  sa.target_kpi,
  sa.kpi_target_value,
  sa.unit_of_measure,
  sa.standard_id,
  sa.task_type,
  ${RF_ACTIVITY_FY_SELECT},
  st.title AS standard_title,
  st.quality_standard,
  st.output_standard,
  st.performance_indicator,
  COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name,
  ${buildResultsFrameworkMatrixActualSelect()}
  `;
}

export function buildResultsFrameworkAmbassadorMatrixSelect(): string {
  return `
  ${buildResultsFrameworkMatrixActivitySelect().trim()},
  arn.outcome_reason AS ambassador_outcome_reason,
  arn.practice_type AS ambassador_practice_type,
  ${STAFF_NARRATIVE_SUBQUERY}
  `;
}

export type AmbassadorResultsFrameworkMatrixRow = ResultsFrameworkMatrixRow & {
  title: string;
  performanceStatus: PerformanceStatus | null;
  performanceStatusLabel: string;
  statusFyLabel: string;
  outcomeReason: string | null;
  practiceType: PracticeType | null;
  practiceTypeLabel: string | null;
  narrativeSource: 'ambassador' | 'staff' | null;
  ambassadorNarrativeRecorded: boolean;
  needsAmbassadorNarrative: boolean;
};

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatOutcomeOutputLabel(row: {
  quality_standard?: string | null;
  output_standard?: string | null;
  standard_title?: string | null;
}): string {
  const quality = String(row.quality_standard || '').trim();
  const output = String(row.output_standard || '').trim();
  if (quality && output) return `${quality} / ${output}`;
  if (quality) return quality;
  if (output) return output;
  return String(row.standard_title || '').trim() || '—';
}

export function mapResultsFrameworkMatrixRows(rows: ResultsFrameworkDbRow[]): ResultsFrameworkMatrixRow[] {
  return rows
    .filter((row) =>
      activityQualifiesForResultsFrameworkMatrix({
        ...row,
        performance_indicator: row.performance_indicator,
      }),
    )
    .map((row) => mapSingleResultsFrameworkMatrixRow(row));
}

function mapSingleResultsFrameworkMatrixRow(row: ResultsFrameworkDbRow): ResultsFrameworkMatrixRow {
  const indicator = resolveRfPerformanceIndicator({
    target_kpi: row.target_kpi,
    kpi_target_value: row.kpi_target_value,
    performance_indicator: row.performance_indicator,
    target_fy25_26: row.target_fy25_26,
    target_fy26_27: row.target_fy26_27,
    target_fy27_28: row.target_fy27_28,
    target_fy28_29: row.target_fy28_29,
    target_fy29_30: row.target_fy29_30,
  });

  const fiscalYears: ResultsFrameworkMatrixFyCell[] = RF_MATRIX_FY_COLUMNS.map((col) => ({
    label: col.label,
    target: toNumberOrNull(row[col.targetKey]),
    actual: toNumberOrNull(row[col.actualAlias as keyof ResultsFrameworkDbRow]),
  }));

  return {
    id: row.id,
    outcomeOutput: formatOutcomeOutputLabel(row),
    indicator: indicator || row.title,
    baseline2024_25: toNumberOrNull(row.kpi_target_value),
    fiscalYears,
    budget: null,
    responsibleOffice: row.department_name || '—',
    unitOfMeasure: row.unit_of_measure,
  };
}

export function mapResultsFrameworkAmbassadorMatrixRows(
  rows: ResultsFrameworkDbRow[],
  financialYearKey: string,
): AmbassadorResultsFrameworkMatrixRow[] {
  const matrixFyLabel = rfMatrixFyLabelFromFyKey(financialYearKey);
  const fyRange = fyRangeJulyJune(financialYearKey);

  return rows
    .filter((row) =>
      activityQualifiesForResultsFrameworkMatrix({
        ...row,
        performance_indicator: row.performance_indicator,
      }),
    )
    .map((row) => {
      const matrix = mapSingleResultsFrameworkMatrixRow(row);
      const rfInput: RfActivityTargetInput = {
        target_kpi: row.target_kpi,
        kpi_target_value: row.kpi_target_value,
        performance_indicator: row.performance_indicator,
        target_fy25_26: row.target_fy25_26,
        target_fy26_27: row.target_fy26_27,
        target_fy27_28: row.target_fy27_28,
        target_fy28_29: row.target_fy28_29,
        target_fy29_30: row.target_fy29_30,
      };

      const target = resolveRfTargetValue(rfInput, financialYearKey);
      const fyCell = matrixFyLabel
        ? matrix.fiscalYears.find((fy) => fy.label === matrixFyLabel)
        : undefined;
      const actual = fyCell?.actual ?? null;
      const performanceStatus = computePerformanceStatus(target, actual);

      const ambassadorReason = String(row.ambassador_outcome_reason || '').trim() || null;
      const staffReason = String(row.staff_outcome_reason || '').trim() || null;
      const outcomeReason = ambassadorReason || staffReason;
      const practiceType = row.ambassador_practice_type ?? row.staff_practice_type ?? null;
      const narrativeSource: 'ambassador' | 'staff' | null = ambassadorReason
        ? 'ambassador'
        : staffReason
          ? 'staff'
          : null;
      const ambassadorNarrativeRecorded = Boolean(ambassadorReason);
      const needsAmbassadorNarrative =
        performanceStatus != null && !ambassadorNarrativeRecorded;

      return {
        ...matrix,
        title: row.title,
        performanceStatus,
        performanceStatusLabel: performanceStatus
          ? PERFORMANCE_STATUS_LABELS[performanceStatus]
          : 'Not assessed',
        outcomeReason,
        practiceType,
        practiceTypeLabel: practiceType ? PRACTICE_TYPE_LABELS[practiceType] : null,
        narrativeSource,
        ambassadorNarrativeRecorded,
        needsAmbassadorNarrative,
        statusFyLabel: fyRange?.label ?? financialYearKey,
      };
    });
}

export const RESULTS_FRAMEWORK_ACTIVITY_SELECT = buildResultsFrameworkActivitySelect('2025/26');

export const RESULTS_FRAMEWORK_NARRATIVE_JOIN = `
  LEFT JOIN activity_rf_narratives arn
    ON arn.activity_id = sa.id AND arn.financial_year_key = ?
`;

export type MappedResultsFrameworkRow = {
  id: number;
  title: string;
  departmentName: string;
  targetKpi: string | null;
  targetValue: number | null;
  actualValue: number | null;
  unitOfMeasure: string | null;
  standardTitle: string | null;
  performanceIndicator: string | null;
  performanceStatus: PerformanceStatus | null;
  performanceStatusLabel: string;
  outcomeReason: string | null;
  practiceType: PracticeType | null;
  practiceTypeLabel: string | null;
  narrativeSource: 'ambassador' | 'staff' | null;
  expectedOutcome: string | null;
  qualityStandard: string | null;
  outputStandard: string | null;
  resultCategory: 'outcome' | 'output' | 'both' | null;
  ambassadorNarrativeRecorded: boolean;
  needsAmbassadorNarrative: boolean;
};

export function classifyRfResultCategory(row: {
  quality_standard?: string | null;
  output_standard?: string | null;
}): 'outcome' | 'output' | 'both' | null {
  const hasQuality = Boolean(String(row.quality_standard || '').trim());
  const hasOutput = Boolean(String(row.output_standard || '').trim());
  if (hasQuality && hasOutput) return 'both';
  if (hasQuality) return 'outcome';
  if (hasOutput) return 'output';
  return null;
}

export function filterResultsFrameworkByCategory(
  indicators: MappedResultsFrameworkRow[],
  category: 'outcome' | 'output'
): MappedResultsFrameworkRow[] {
  return indicators.filter((row) => {
    if (row.resultCategory === 'both') return true;
    if (category === 'outcome') return row.resultCategory === 'outcome';
    return row.resultCategory === 'output';
  });
}

export function mapResultsFrameworkRows(
  rows: ResultsFrameworkDbRow[],
  financialYear?: string
): MappedResultsFrameworkRow[] {
  return rows
    .filter((row) =>
      activityQualifiesForResultsFramework(
        {
          ...row,
          performance_indicator: row.performance_indicator,
        },
        financialYear
      )
    )
    .map((row) => {
      const rfInput: RfActivityTargetInput = {
        target_kpi: row.target_kpi,
        kpi_target_value: row.kpi_target_value,
        performance_indicator: row.performance_indicator,
        target_fy25_26: row.target_fy25_26,
        target_fy26_27: row.target_fy26_27,
        target_fy27_28: row.target_fy27_28,
        target_fy28_29: row.target_fy28_29,
        target_fy29_30: row.target_fy29_30,
      };

      const indicator = resolveRfPerformanceIndicator(rfInput);
      const target = resolveRfTargetValue(rfInput, financialYear ?? new Date());
      const actual = row.actual_value != null ? Number(row.actual_value) : null;
      const performanceStatus: PerformanceStatus | null = computePerformanceStatus(target, actual);

      const ambassadorReason = String(row.ambassador_outcome_reason || '').trim() || null;
      const staffReason = String(row.staff_outcome_reason || '').trim() || null;
      const outcomeReason = ambassadorReason || staffReason;
      const practiceType = row.ambassador_practice_type ?? row.staff_practice_type ?? null;
      const narrativeSource: 'ambassador' | 'staff' | null = ambassadorReason
        ? 'ambassador'
        : staffReason
          ? 'staff'
          : null;

      const ambassadorNarrativeRecorded = Boolean(ambassadorReason);
      const needsAmbassadorNarrative =
        performanceStatus != null && !ambassadorNarrativeRecorded;
      const qualityStandard = String(row.quality_standard || '').trim() || null;
      const outputStandard = String(row.output_standard || '').trim() || null;
      const resultCategory = classifyRfResultCategory(row);

      return {
        id: row.id,
        title: row.title,
        departmentName: row.department_name || '—',
        targetKpi: indicator,
        targetValue: target,
        actualValue: actual,
        unitOfMeasure: row.unit_of_measure,
        standardTitle: row.standard_title,
        performanceIndicator: indicator,
        performanceStatus,
        performanceStatusLabel: performanceStatus ? PERFORMANCE_STATUS_LABELS[performanceStatus] : 'Not assessed',
        outcomeReason,
        practiceType,
        practiceTypeLabel: practiceType ? PRACTICE_TYPE_LABELS[practiceType] : null,
        narrativeSource,
        expectedOutcome: qualityStandard || outputStandard || indicator,
        qualityStandard,
        outputStandard,
        resultCategory,
        ambassadorNarrativeRecorded,
        needsAmbassadorNarrative,
      };
    });
}

export function summarizeResultsFramework(indicators: MappedResultsFrameworkRow[]): ResultsFrameworkSummary {
  let assessed = 0;
  let underperformance = 0;
  let achievement = 0;
  let overachievement = 0;
  let narrativesRecorded = 0;
  let narrativesMissing = 0;

  for (const row of indicators) {
    if (row.performanceStatus) {
      assessed += 1;
      if (row.performanceStatus === 'underperformance') underperformance += 1;
      else if (row.performanceStatus === 'achievement') achievement += 1;
      else if (row.performanceStatus === 'overachievement') overachievement += 1;
      if (row.needsAmbassadorNarrative) narrativesMissing += 1;
    }
    if (row.ambassadorNarrativeRecorded) narrativesRecorded += 1;
  }

  const narrativesRequired = assessed;

  return {
    total: indicators.length,
    assessed,
    notAssessed: indicators.length - assessed,
    underperformance,
    achievement,
    overachievement,
    narrativesRecorded,
    narrativesRequired,
    narrativesMissing,
    narrativesComplete: narrativesRequired - narrativesMissing,
  };
}

export const RESULTS_FRAMEWORK_KPI_FILTER = buildResultsFrameworkKpiFilterSql('sa', 'st');

export const MAIN_STRATEGIC_ACTIVITY_FILTER = `
  sa.parent_id IS NULL
  AND COALESCE(TRIM(sa.source), '') <> ''
`;
