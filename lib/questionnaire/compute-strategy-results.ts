import { query } from '@/lib/db';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import {
  inputMetricsForIndicator,
  parseLooseNumber,
  primaryActualByFy,
  type MetricTreeNode,
} from '@/lib/questionnaire/metric-tree';
import { SQL_RESOLVED_INDICATOR_PILLAR, SQL_RESOLVED_INDICATOR_PILLAR_CODE } from '@/lib/questionnaire-schema';
import { computePerformanceStatus, type PerformanceStatus } from '@/lib/results-framework';
import {
  listResultFormulas,
  type ResultFormulaOperand,
  type ResultOperation,
} from '@/lib/questionnaire/result-formulas';

export type StrategyResultMethod = 'sum' | 'single' | 'entered_percent' | 'entered_ratio' | 'not_numeric';

export type StrategyFyCell = {
  target: string | null;
  actual: number | null;
  display: string | null;
  pctOfTarget: number | null;
  performance: PerformanceStatus | null;
  officesWithValues: number;
  method: StrategyResultMethod;
  note: string | null;
};

export type StrategyMetricOption = {
  id: number;
  metricText: string;
  unitOfMeasure: string;
  isInput: boolean;
};

export type StrategyIndicatorResult = {
  indicatorId: number;
  indicatorText: string;
  outcomeLabel: string;
  outcomeType: string;
  strategicPillar: string | null;
  pillarCode: string | null;
  assignedOffices: number;
  method: StrategyResultMethod;
  metrics: StrategyMetricOption[];
  byFy: Record<string, StrategyFyCell>;
  suggested: Array<{ operation: ResultOperation; label: string; operands: ResultFormulaOperand[] }>;
};

export type StrategyFormulaResult = {
  id: number;
  name: string;
  operation: ResultOperation;
  operands: ResultFormulaOperand[];
  compareIndicatorId: number | null;
  byFy: Record<string, StrategyFyCell>;
};

export type StrategyResultsPayload = {
  financialYears: string[];
  indicators: StrategyIndicatorResult[];
  formulas: StrategyFormulaResult[];
  approvedOnly: boolean;
};

type Dept = { id: number; name: string };
type TargetRow = { indicator_id: number; financial_year: string; target_value: string | null };
type ResponseRow = {
  indicator_id: number;
  metric_id: number;
  department_id: number;
  financial_year: string;
  value: string | null;
};

function sortFy(a: string, b: string): number {
  return normalizeFinancialYear(a).localeCompare(normalizeFinancialYear(b));
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

export function formatRatioAsNToOne(numerator: number, denominator: number): string | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return `${formatNumber(numerator / denominator)}:1`;
}

function isSummableUom(uom: string): boolean {
  return uom === 'numeric' || uom === 'currency';
}

function methodForMetrics(metrics: MetricTreeNode[]): StrategyResultMethod {
  const inputs = inputMetricsForIndicator(metrics);
  if (inputs.length === 0) return 'not_numeric';
  const uoms = new Set(inputs.map((m) => m.unit_of_measure));
  if ([...uoms].every(isSummableUom)) return 'sum';
  if (uoms.size === 1 && uoms.has('percentage')) return 'entered_percent';
  if (uoms.size === 1 && uoms.has('ratio')) return 'entered_ratio';
  if ([...uoms].every((u) => u === 'text' || u === 'list')) return 'not_numeric';
  if ([...uoms].some(isSummableUom)) return 'sum';
  return 'not_numeric';
}

function looksLikeFemale(text: string): boolean {
  return /\bfemales?\b/i.test(text);
}

function looksLikeMale(text: string): boolean {
  return /\bmales?\b/i.test(text) && !/\bfemales?\b/i.test(text);
}

function officeActual(
  metrics: MetricTreeNode[],
  fy: string,
  getVal: (metricId: number, fy: string) => string | null | undefined,
): number | null {
  const primary = primaryActualByFy(metrics, [fy], getVal)[fy];
  const fromPrimary = parseLooseNumber(primary);
  if (fromPrimary != null) return fromPrimary;

  const inputs = inputMetricsForIndicator(metrics).filter((m) => isSummableUom(m.unit_of_measure));
  let sum = 0;
  let any = false;
  for (const m of inputs) {
    const n = parseLooseNumber(getVal(m.id, fy));
    if (n == null) continue;
    sum += n;
    any = true;
  }
  return any ? sum : null;
}

function metricActualAcrossOffices(
  metrics: MetricTreeNode[],
  metricId: number | null,
  fy: string,
  assigned: Dept[],
  getVal: (departmentId: number, metricId: number, fy: string) => string | null,
): { actual: number | null; offices: number } {
  let sum = 0;
  let offices = 0;
  for (const dept of assigned) {
    let n: number | null;
    if (metricId != null) {
      n = parseLooseNumber(getVal(dept.id, metricId, fy));
    } else {
      n = officeActual(metrics, fy, (id, year) => getVal(dept.id, id, year));
    }
    if (n == null) continue;
    sum += n;
    offices += 1;
  }
  return { actual: offices > 0 ? sum : null, offices };
}

function cellFromActual(
  actual: number | null,
  targetRaw: string | null,
  offices: number,
  method: StrategyResultMethod,
  displayOverride?: string | null,
  note?: string | null,
): StrategyFyCell {
  const targetNum = parseLooseNumber(targetRaw);
  const pct = actual != null && targetNum != null && targetNum !== 0
    ? (actual / targetNum) * 100
    : actual != null && targetNum === 0
      ? (actual === 0 ? 100 : null)
      : null;
  const performance = computePerformanceStatus(targetNum, actual);
  return {
    target: targetRaw,
    actual,
    display: displayOverride ?? (actual != null ? formatNumber(actual) : null),
    pctOfTarget: pct != null ? Math.round(pct * 10) / 10 : null,
    performance,
    officesWithValues: offices,
    method,
    note: note ?? null,
  };
}

function applyOperation(
  operation: ResultOperation,
  values: number[],
): { actual: number | null; display: string | null; note: string | null } {
  if (values.length === 0) return { actual: null, display: null, note: null };
  if (operation === 'sum') {
    const actual = values.reduce((a, b) => a + b, 0);
    return { actual, display: formatNumber(actual), note: null };
  }
  if (operation === 'mean') {
    const actual = values.reduce((a, b) => a + b, 0) / values.length;
    return { actual, display: formatNumber(actual), note: 'Mean of selected inputs (after summing each across offices).' };
  }
  if (values.length < 2) {
    return { actual: null, display: null, note: 'This formula needs two inputs (A and B).' };
  }
  const [a, b] = values;
  if (operation === 'divide') {
    if (b === 0) return { actual: null, display: null, note: 'Cannot divide by zero.' };
    const actual = a / b;
    return { actual, display: formatNumber(actual), note: null };
  }
  if (operation === 'percent') {
    if (b === 0) return { actual: null, display: null, note: 'Cannot divide by zero.' };
    const actual = (a / b) * 100;
    return { actual, display: `${formatNumber(actual)}%`, note: null };
  }
  if (operation === 'share') {
    const total = a + b;
    if (total === 0) return { actual: null, display: null, note: 'A + B is zero.' };
    const actual = (a / total) * 100;
    return { actual, display: `${formatNumber(actual)}%`, note: 'A ÷ (A + B) × 100, after summing each across offices.' };
  }
  if (operation === 'ratio') {
    const display = formatRatioAsNToOne(a, b);
    const actual = b === 0 ? null : a / b;
    return { actual, display, note: null };
  }
  return { actual: null, display: null, note: null };
}

function suggestionsFor(indicatorId: number, metrics: MetricTreeNode[]): StrategyIndicatorResult['suggested'] {
  const inputs = inputMetricsForIndicator(metrics);
  const female = inputs.find((m) => looksLikeFemale(m.metric_text));
  const male = inputs.find((m) => looksLikeMale(m.metric_text));
  if (!female || !male) return [];
  return [
    {
      operation: 'share',
      label: `% female (${female.metric_text} ÷ (${female.metric_text} + ${male.metric_text}) × 100)`,
      operands: [
        { indicatorId, metricId: female.id },
        { indicatorId, metricId: male.id },
      ],
    },
    {
      operation: 'ratio',
      label: `Gender parity (${female.metric_text} : ${male.metric_text})`,
      operands: [
        { indicatorId, metricId: female.id },
        { indicatorId, metricId: male.id },
      ],
    },
  ];
}

export async function buildStrategyResults(approvedOnly: boolean): Promise<StrategyResultsPayload> {
  const indicatorRows = (await query({
    query: `SELECT i.id, i.indicator_text,
                   o.type AS outcome_type, o.label AS outcome_label,
                   ${SQL_RESOLVED_INDICATOR_PILLAR} AS strategic_pillar,
                   ${SQL_RESOLVED_INDICATOR_PILLAR_CODE} AS pillar_code
            FROM q_indicators i
            JOIN q_outcomes o ON o.id = i.outcome_id
            ORDER BY strategic_pillar, o.strategic_objective, o.type, o.label, i.indicator_text`,
  })) as {
    id: number;
    indicator_text: string;
    outcome_type: string;
    outcome_label: string;
    strategic_pillar: string | null;
    pillar_code: string | null;
  }[];

  const metricRows = (await query({
    query: `SELECT id, indicator_id, metric_text, unit_of_measure, parent_metric_id, aggregation, is_total, sort_order
            FROM q_metrics ORDER BY indicator_id, sort_order`,
  })) as (MetricTreeNode & { indicator_id: number })[];

  const deptRows = (await query({
    query: `SELECT qid.indicator_id, d.id, COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS name
            FROM q_indicator_departments qid
            JOIN departments d ON d.id = qid.department_id
            ORDER BY name`,
  })) as { indicator_id: number; id: number; name: string }[];

  const fyRows = (await query({
    query: 'SELECT indicator_id, financial_year FROM q_indicator_fys',
  })) as { indicator_id: number; financial_year: string }[];

  const targetRows = (await query({
    query: 'SELECT indicator_id, financial_year, target_value FROM q_indicator_fy_targets',
  })) as TargetRow[];

  let responseSql = `
    SELECT r.indicator_id, r.metric_id, r.department_id, r.financial_year, r.value
    FROM q_responses r
    WHERE r.value IS NOT NULL AND TRIM(r.value) <> ''
  `;
  if (approvedOnly) {
    responseSql += `
      AND (
        NOT EXISTS (
          SELECT 1 FROM q_indicator_submissions qis0
          WHERE qis0.indicator_id = r.indicator_id AND qis0.department_id = r.department_id
        )
        OR EXISTS (
          SELECT 1 FROM q_indicator_submissions qis
          WHERE qis.indicator_id = r.indicator_id
            AND qis.department_id = r.department_id
            AND qis.hod_review_status = 'approved'
        )
      )
    `;
  }
  const responseRows = (await query({ query: responseSql })) as ResponseRow[];

  const metricsByIndicator = new Map<number, MetricTreeNode[]>();
  for (const m of metricRows) {
    const id = Number(m.indicator_id);
    const list = metricsByIndicator.get(id) ?? [];
    list.push({
      id: Number(m.id),
      metric_text: String(m.metric_text || ''),
      unit_of_measure: String(m.unit_of_measure || 'numeric'),
      parent_metric_id: m.parent_metric_id != null ? Number(m.parent_metric_id) : null,
      aggregation: m.aggregation ?? null,
      is_total: m.is_total ?? 0,
      sort_order: Number(m.sort_order ?? 0),
    });
    metricsByIndicator.set(id, list);
  }

  const deptsByIndicator = new Map<number, Dept[]>();
  for (const d of deptRows) {
    const id = Number(d.indicator_id);
    const list = deptsByIndicator.get(id) ?? [];
    list.push({ id: Number(d.id), name: String(d.name || '') });
    deptsByIndicator.set(id, list);
  }

  const fysByIndicator = new Map<number, string[]>();
  const allFys = new Set<string>();
  const addFy = (indicatorId: number, raw: string) => {
    const fy = normalizeFinancialYear(raw);
    if (!fy) return;
    const list = fysByIndicator.get(indicatorId) ?? [];
    if (!list.includes(fy)) list.push(fy);
    fysByIndicator.set(indicatorId, list);
    allFys.add(fy);
  };
  for (const f of fyRows) addFy(Number(f.indicator_id), f.financial_year);
  for (const t of targetRows) addFy(Number(t.indicator_id), t.financial_year);
  for (const r of responseRows) addFy(Number(r.indicator_id), r.financial_year);

  const targetByKey = new Map<string, string>();
  for (const t of targetRows) {
    const v = t.target_value != null && String(t.target_value).trim() !== '' ? String(t.target_value).trim() : '';
    if (!v) continue;
    targetByKey.set(`${Number(t.indicator_id)}|${normalizeFinancialYear(t.financial_year)}`, v);
  }

  const valueMap = new Map<string, string>();
  for (const r of responseRows) {
    const fy = normalizeFinancialYear(r.financial_year);
    valueMap.set(`${Number(r.indicator_id)}|${Number(r.department_id)}|${Number(r.metric_id)}|${fy}`, String(r.value));
  }

  const getVal = (indicatorId: number, departmentId: number, metricId: number, fy: string) =>
    valueMap.get(`${indicatorId}|${departmentId}|${metricId}|${normalizeFinancialYear(fy)}`) ?? null;

  const financialYears = [...allFys].sort(sortFy);

  const indicators: StrategyIndicatorResult[] = indicatorRows.map((ind) => {
    const indicatorId = Number(ind.id);
    const metrics = metricsByIndicator.get(indicatorId) ?? [];
    const assigned = deptsByIndicator.get(indicatorId) ?? [];
    const fys = (fysByIndicator.get(indicatorId) ?? []).sort(sortFy);
    const method = methodForMetrics(metrics);
    const inputs = inputMetricsForIndicator(metrics);
    const byFy: Record<string, StrategyFyCell> = {};

    for (const fy of fys) {
      const target = targetByKey.get(`${indicatorId}|${fy}`) ?? null;
      if (method === 'not_numeric') {
        byFy[fy] = cellFromActual(null, target, 0, method, null, 'This indicator is text or mixed units, so it is not auto-totalled.');
        continue;
      }
      if (method === 'entered_percent' || method === 'entered_ratio') {
        const rolled = metricActualAcrossOffices(metrics, null, fy, assigned, (deptId, metricId, year) =>
          getVal(indicatorId, deptId, metricId, year),
        );
        if (rolled.offices <= 1) {
          byFy[fy] = cellFromActual(
            rolled.actual,
            target,
            rolled.offices,
            'single',
            method === 'entered_percent' && rolled.actual != null ? `${formatNumber(rolled.actual)}%` : null,
            rolled.offices === 1
              ? 'One office entered this value. Institutional % or ratio should be calculated from counts (Female and Male), not averaged across offices.'
              : null,
          );
        } else {
          byFy[fy] = cellFromActual(
            null,
            target,
            rolled.offices,
            method,
            null,
            `${rolled.offices} offices entered a ${method === 'entered_percent' ? 'percentage' : 'ratio'}. These are not added together. Add a formula using Female and Male counts, or collect counts instead.`,
          );
        }
        continue;
      }

      const rolled = metricActualAcrossOffices(metrics, null, fy, assigned, (deptId, metricId, year) =>
        getVal(indicatorId, deptId, metricId, year),
      );
      const cellMethod: StrategyResultMethod = rolled.offices > 1 ? 'sum' : 'single';
      byFy[fy] = cellFromActual(
        rolled.actual,
        target,
        rolled.offices,
        cellMethod,
        null,
        rolled.offices > 1 ? `Sum of ${rolled.offices} offices.` : null,
      );
    }

    return {
      indicatorId,
      indicatorText: String(ind.indicator_text || ''),
      outcomeLabel: String(ind.outcome_label || ''),
      outcomeType: String(ind.outcome_type || ''),
      strategicPillar: ind.strategic_pillar != null ? String(ind.strategic_pillar) : null,
      pillarCode: ind.pillar_code != null ? String(ind.pillar_code) : null,
      assignedOffices: assigned.length,
      method,
      metrics: metrics.map((m) => ({
        id: m.id,
        metricText: m.metric_text,
        unitOfMeasure: m.unit_of_measure,
        isInput: inputs.some((i) => i.id === m.id),
      })),
      byFy,
      suggested: suggestionsFor(indicatorId, metrics),
    };
  });

  const formulaRows = await listResultFormulas();
  const indicatorMap = new Map(indicators.map((i) => [i.indicatorId, i]));

  const operandActual = (
    operand: ResultFormulaOperand,
    fy: string,
  ): { actual: number | null; offices: number } => {
    const metrics = metricsByIndicator.get(operand.indicatorId) ?? [];
    const assigned = deptsByIndicator.get(operand.indicatorId) ?? [];
    return metricActualAcrossOffices(metrics, operand.metricId, fy, assigned, (deptId, metricId, year) =>
      getVal(operand.indicatorId, deptId, metricId, year),
    );
  };

  const formulas: StrategyFormulaResult[] = formulaRows.map((formula) => {
    const fysForFormula = new Set<string>();
    for (const op of formula.operands) {
      for (const fy of fysByIndicator.get(op.indicatorId) ?? []) fysForFormula.add(fy);
    }
    const years = (fysForFormula.size ? [...fysForFormula] : financialYears).sort(sortFy);
    const byFy: Record<string, StrategyFyCell> = {};
    const compare = formula.compareIndicatorId != null ? indicatorMap.get(formula.compareIndicatorId) : null;

    for (const fy of years) {
      const parts: number[] = [];
      let offices = 0;
      let missing = false;
      for (const op of formula.operands) {
        const rolled = operandActual(op, fy);
        offices += rolled.offices;
        if (rolled.actual == null) {
          missing = true;
          break;
        }
        parts.push(rolled.actual);
      }
      const target = compare?.byFy[fy]?.target ?? null;
      if (missing) {
        byFy[fy] = cellFromActual(null, target, offices, 'sum', null, 'One of the selected inputs has no numeric value for this year.');
        continue;
      }
      const applied = applyOperation(formula.operation, parts);
      const method: StrategyResultMethod = formula.operation === 'percent' || formula.operation === 'share'
        ? 'entered_percent'
        : formula.operation === 'ratio'
          ? 'entered_ratio'
          : 'sum';
      byFy[fy] = cellFromActual(applied.actual, target, offices, method, applied.display, applied.note);
    }

    return {
      id: formula.id,
      name: formula.name,
      operation: formula.operation,
      operands: formula.operands,
      compareIndicatorId: formula.compareIndicatorId,
      byFy,
    };
  });

  return { financialYears, indicators, formulas, approvedOnly };
}
