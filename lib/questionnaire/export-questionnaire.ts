import { normalizeFinancialYear, fyShortLabel } from '@/lib/questionnaire/fy-utils';
import { uomLabel } from '@/lib/questionnaire/uom';
import { CORE_OBJECTIVES_2025_2030, coreObjectiveShortTitle, type CoreObjective } from '@/lib/strategic-plan';

export type IndicatorTarget = { financial_year: string; target_value: string | null };

function indicatorTargetFor(targets: IndicatorTarget[] | undefined, fy: string): string | null {
  const normalized = normalizeFinancialYear(fy);
  const row = targets?.find((t) => normalizeFinancialYear(t.financial_year) === normalized);
  const v = row?.target_value;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

export type ExportIndicator = {
  id: number;
  indicator_text: string;
  outcome_type: string;
  outcome_label: string;
  outcome_strategic_objective: string | null;
  metrics: { metric_text: string; unit_of_measure: string; sort_order: number }[];
  targets?: IndicatorTarget[];
  departments: { id: number; name: string }[];
  financial_years: string[];
};

export type ExportDepartment = { id: number; name: string };
export type ExportScope = 'all' | 'department';

export function filterIndicatorsByDepartment(
  indicators: ExportIndicator[],
  departmentId: number | null,
): ExportIndicator[] {
  if (!departmentId) return [...indicators];
  return indicators.filter((ind) => ind.departments.some((d) => d.id === departmentId));
}

export function departmentsFromIndicators(indicators: ExportIndicator[]): ExportDepartment[] {
  const map = new Map<number, string>();
  for (const ind of indicators) {
    for (const d of ind.departments) {
      map.set(d.id, d.name);
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Compact: `2024/25 → 15 · 2025/26 → 30` */
export function formatIndicatorTargetsCompact(ind: ExportIndicator): string {
  if (!ind.financial_years.length) return '—';
  return ind.financial_years
    .map((fy) => {
      const target = indicatorTargetFor(ind.targets, fy);
      const label = fyShortLabel(fy);
      return target ? `${label} → ${target}` : label;
    })
    .join('  ·  ');
}

/** @deprecated Use formatIndicatorTargetsCompact */
export const formatIndicatorTargets = formatIndicatorTargetsCompact;

export type QuestionnaireMetricRow = Record<string, string | number>;

export type BuildRowsOptions = {
  /** Omit responsible-units column (per-unit exports). */
  omitResponsibleUnits?: boolean;
};

export function formatOutcomeHeading(outcomeType: string, outcomeLabel: string): string {
  const type = outcomeType.trim();
  const label = outcomeLabel.trim();
  if (label.toLowerCase().startsWith(type.toLowerCase())) return label;
  return `${type}: ${label}`;
}

export function collectFinancialYears(indicators: ExportIndicator[]): string[] {
  const set = new Set<string>();
  for (const ind of indicators) {
    for (const fy of ind.financial_years) {
      set.add(normalizeFinancialYear(fy));
    }
  }
  return [...set].sort();
}

export function indicatorTargetForExport(
  targets: IndicatorTarget[] | undefined,
  fy: string,
): string | null {
  return indicatorTargetFor(targets, fy);
}

export function sortIndicatorsForExport(indicators: ExportIndicator[]): ExportIndicator[] {
  return [...indicators].sort((a, b) => {
    const objA = a.outcome_strategic_objective ?? '';
    const objB = b.outcome_strategic_objective ?? '';
    const idxA = CORE_OBJECTIVES_2025_2030.indexOf(objA as CoreObjective);
    const idxB = CORE_OBJECTIVES_2025_2030.indexOf(objB as CoreObjective);
    const orderA = idxA >= 0 ? idxA : 999;
    const orderB = idxB >= 0 ? idxB : 999;
    if (orderA !== orderB) return orderA - orderB;
    if (a.outcome_type !== b.outcome_type) return a.outcome_type.localeCompare(b.outcome_type);
    if (a.outcome_label !== b.outcome_label) return a.outcome_label.localeCompare(b.outcome_label);
    return a.indicator_text.localeCompare(b.indicator_text);
  });
}

export function buildQuestionnaireMetricRows(
  indicators: ExportIndicator[],
  options: BuildRowsOptions = {},
): QuestionnaireMetricRow[] {
  const rows: QuestionnaireMetricRow[] = [];
  const sorted = sortIndicatorsForExport(indicators);
  const allFys = collectFinancialYears(sorted);

  for (const ind of sorted) {
    const obj = ind.outcome_strategic_objective;
    const objNum = obj ? CORE_OBJECTIVES_2025_2030.indexOf(obj as CoreObjective) + 1 : 0;
    const metrics = [...ind.metrics].sort((a, b) => a.sort_order - b.sort_order);
    const indFySet = new Set(ind.financial_years.map(normalizeFinancialYear));

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const row: QuestionnaireMetricRow = {
        'Objective': objNum > 0 ? `Objective ${objNum}` : '—',
        'Type': ind.outcome_type,
        'Outcome / Output': ind.outcome_label,
        'Indicator': ind.indicator_text,
        'Institution targets': i === 0 ? formatIndicatorTargetsCompact(ind) : '',
        'Metric #': i + 1,
        'Performance Metric': m.metric_text,
        'Unit': uomLabel(m.unit_of_measure),
      };
      for (const fy of allFys) {
        const col = fyShortLabel(fy);
        row[col] = indFySet.has(fy) ? '' : '—';
      }
      if (!options.omitResponsibleUnits) {
        row['Responsible Units'] = ind.departments.map((d) => d.name).join(', ');
      }
      rows.push(row);
    }
  }
  return rows;
}

export type GroupedExportSection = {
  objective: string | null;
  objectiveTitle: string;
  outcomes: {
    outcomeType: string;
    outcomeLabel: string;
    indicators: ExportIndicator[];
  }[];
};

export function groupIndicatorsForExport(indicators: ExportIndicator[]): GroupedExportSection[] {
  const sorted = sortIndicatorsForExport(indicators);
  const sections: GroupedExportSection[] = [];

  for (const ind of sorted) {
    const objKey = ind.outcome_strategic_objective ?? '__unassigned__';
    let section = sections.find((s) => (s.objective ?? '__unassigned__') === objKey);
    if (!section) {
      section = {
        objective: ind.outcome_strategic_objective,
        objectiveTitle: coreObjectiveShortTitle(ind.outcome_strategic_objective),
        outcomes: [],
      };
      sections.push(section);
    }

    let outcomeGroup = section.outcomes.find(
      (o) => o.outcomeType === ind.outcome_type && o.outcomeLabel === ind.outcome_label,
    );
    if (!outcomeGroup) {
      outcomeGroup = { outcomeType: ind.outcome_type, outcomeLabel: ind.outcome_label, indicators: [] };
      section.outcomes.push(outcomeGroup);
    }
    outcomeGroup.indicators.push(ind);
  }

  return sections;
}

export type DepartmentExportBundle = {
  department: ExportDepartment;
  sections: GroupedExportSection[];
  indicatorCount: number;
  metricCount: number;
};

export function groupExportByDepartment(
  indicators: ExportIndicator[],
  departments: ExportDepartment[],
): DepartmentExportBundle[] {
  return departments
    .map((department) => {
      const deptIndicators = filterIndicatorsByDepartment(indicators, department.id);
      return {
        department,
        sections: groupIndicatorsForExport(deptIndicators),
        indicatorCount: deptIndicators.length,
        metricCount: deptIndicators.reduce((sum, ind) => sum + ind.metrics.length, 0),
      };
    })
    .filter((bundle) => bundle.indicatorCount > 0);
}

export function exportSummary(indicators: ExportIndicator[]) {
  const metricCount = indicators.reduce((sum, ind) => sum + ind.metrics.length, 0);
  const units = departmentsFromIndicators(indicators);
  return {
    indicatorCount: indicators.length,
    metricCount,
    unitCount: units.length,
    units,
  };
}

export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 28);
  return cleaned || 'Sheet';
}

export function buildExportFilename(
  scope: ExportScope,
  departmentName?: string,
  ext: 'pdf' | 'xlsx' = 'pdf',
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = scope === 'department' && departmentName
    ? departmentName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)
    : 'All_Units';
  return `MUBS_Questionnaire_${slug}_${stamp}.${ext}`;
}

export const EXCEL_COLUMN_WIDTHS: Record<string, number> = {
  'Objective': 12,
  'Type': 10,
  'Outcome / Output': 36,
  'Indicator': 36,
  'Institution targets': 24,
  'Responsible Units': 28,
  'Metric #': 8,
  'Performance Metric': 42,
  'Unit': 12,
};
