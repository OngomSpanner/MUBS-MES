import { query } from '@/lib/db';
import { normalizeFinancialYear } from '@/lib/questionnaire/fy-utils';
import {
  inputMetricsForIndicator,
  parseLooseNumber,
  primaryActualByFy,
  type MetricTreeNode,
} from '@/lib/questionnaire/metric-tree';
import { SQL_RESOLVED_INDICATOR_PILLAR, SQL_RESOLVED_INDICATOR_PILLAR_CODE } from '@/lib/questionnaire-schema';
import { computePerformanceStatus } from '@/lib/results-framework';
import {
  listResultFormulas,
  type ResultFormulaOperand,
  type ResultOperation,
} from '@/lib/questionnaire/result-formulas';
import type {
  StrategyFormulaResult,
  StrategyFyCell,
  StrategyIndicatorResult,
  StrategyResultMethod,
  StrategyResultsPayload,
} from '@/lib/questionnaire/strategy-results-types';

export type {
  StrategyFormulaResult,
  StrategyFyCell,
  StrategyIndicatorResult,
  StrategyMetricOption,
  StrategyResultMethod,
  StrategyResultsPayload,
} from '@/lib/questionnaire/strategy-results-types';

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

function indicatorExpectsPercent(text: string): boolean {
  return /\bpercent(?:age)?s?\b|%/i.test(text);
}

function indicatorExpectsRatio(text: string): boolean {
  return /\bratio\b|\bparity\b/i.test(text);
}

function looksLikeFilledPosts(text: string): boolean {
  if (/\bestablishment\b|\bceiling\b|\bapproved\s+posts?\b|\bstructure\b/i.test(text)) return false;
  return /\bfilled\b|\boccupied\b|\bin[\s-]?post\b|\bin[\s-]?position\b/i.test(text);
}

function looksLikeEstablishment(text: string): boolean {
  return /\bestablishment\b|\bceiling\b|\bapproved\s+posts?\b|\bstaff\s+structure\b/i.test(text);
}

function looksLikeTotalOrEnrolled(text: string): boolean {
  return /\btotals?\b|\benrolled\b|\benrolment\b|\benrollment\b/i.test(text);
}

function sumMetricIdsAcrossOffices(
  metrics: MetricTreeNode[],
  metricIds: number[],
  fy: string,
  assigned: Dept[],
  getVal: (departmentId: number, metricId: number, fy: string) => string | null,
): { actual: number | null; offices: number } {
  let actual = 0;
  let any = false;
  let offices = 0;
  for (const metricId of metricIds) {
    const rolled = metricActualAcrossOffices(metrics, metricId, fy, assigned, getVal);
    if (rolled.actual == null) continue;
    actual += rolled.actual;
    any = true;
    offices = Math.max(offices, rolled.offices);
  }
  return { actual: any ? actual : null, offices };
}

/** Institutional % or ratio from count metrics. Null if we cannot do it safely. */
function deriveFromCountMetrics(
  indicatorText: string,
  metrics: MetricTreeNode[],
  fy: string,
  assigned: Dept[],
  getVal: (departmentId: number, metricId: number, fy: string) => string | null,
): { actual: number; display: string; note: string; offices: number; method: StrategyResultMethod } | null {
  const inputs = inputMetricsForIndicator(metrics).filter((m) => isSummableUom(m.unit_of_measure));
  if (inputs.length === 0) return null;

  const femaleIds = inputs.filter((m) => looksLikeFemale(m.metric_text)).map((m) => m.id);
  const maleIds = inputs.filter((m) => looksLikeMale(m.metric_text)).map((m) => m.id);
  const filledIds = inputs.filter((m) => looksLikeFilledPosts(m.metric_text)).map((m) => m.id);
  const establishmentIds = inputs.filter((m) => looksLikeEstablishment(m.metric_text)).map((m) => m.id);
  const totalIds = inputs
    .filter((m) => looksLikeTotalOrEnrolled(m.metric_text) && !looksLikeFemale(m.metric_text) && !looksLikeMale(m.metric_text))
    .map((m) => m.id);

  const wantsRatio = indicatorExpectsRatio(indicatorText) && !indicatorExpectsPercent(indicatorText);
  const wantsPercent = indicatorExpectsPercent(indicatorText);
  const wantsFemaleShare =
    wantsPercent || /%\s*female|percent(?:age)?\s+(?:of\s+)?female|female[s]?\s+enrolled/i.test(indicatorText);

  if (femaleIds.length > 0 && maleIds.length > 0 && (wantsFemaleShare || wantsRatio || /\bgender\s+parity/i.test(indicatorText))) {
    const female = sumMetricIdsAcrossOffices(metrics, femaleIds, fy, assigned, getVal);
    const male = sumMetricIdsAcrossOffices(metrics, maleIds, fy, assigned, getVal);
    if (female.actual == null || male.actual == null) return null;
    const offices = Math.max(female.offices, male.offices);
    if (wantsRatio) {
      const display = formatRatioAsNToOne(female.actual, male.actual);
      const actual = male.actual === 0 ? null : female.actual / male.actual;
      if (actual == null || display == null) return null;
      return {
        actual,
        display,
        note: 'Female ÷ Male as n:1, after summing each across offices.',
        offices,
        method: 'entered_ratio',
      };
    }
    const total = female.actual + male.actual;
    if (total === 0) return null;
    const actual = (female.actual / total) * 100;
    return {
      actual,
      display: `${formatNumber(actual)}%`,
      note: 'Female ÷ (Female + Male) × 100, after summing each across offices.',
      offices,
      method: 'entered_percent',
    };
  }

  if (wantsPercent && femaleIds.length > 0 && totalIds.length > 0) {
    const female = sumMetricIdsAcrossOffices(metrics, femaleIds, fy, assigned, getVal);
    const total = sumMetricIdsAcrossOffices(metrics, totalIds, fy, assigned, getVal);
    if (female.actual == null || total.actual == null || total.actual === 0) return null;
    const actual = (female.actual / total.actual) * 100;
    return {
      actual,
      display: `${formatNumber(actual)}%`,
      note: 'Female ÷ total enrolled × 100, after summing each across offices.',
      offices: Math.max(female.offices, total.offices),
      method: 'entered_percent',
    };
  }

  if (wantsPercent && filledIds.length > 0 && establishmentIds.length > 0) {
    const filled = sumMetricIdsAcrossOffices(metrics, filledIds, fy, assigned, getVal);
    const establishment = sumMetricIdsAcrossOffices(metrics, establishmentIds, fy, assigned, getVal);
    if (filled.actual == null || establishment.actual == null || establishment.actual === 0) return null;
    const actual = (filled.actual / establishment.actual) * 100;
    return {
      actual,
      display: `${formatNumber(actual)}%`,
      note: 'Filled posts ÷ establishment × 100, after summing each across offices.',
      offices: Math.max(filled.offices, establishment.offices),
      method: 'entered_percent',
    };
  }

  return null;
}

function shouldCompareActualToTarget(
  actual: number | null,
  targetNum: number | null,
  method: StrategyResultMethod,
): boolean {
  if (actual == null || targetNum == null) return false;
  // A count sitting on a % scale (e.g. 5963 vs a target of 56.3) is not achievement.
  if (method === 'entered_percent' && targetNum > 0 && targetNum <= 100 && actual > 150) return false;
  return true;
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
  compareToTarget = true,
): StrategyFyCell {
  const targetNum = parseLooseNumber(targetRaw);
  const comparable = compareToTarget && shouldCompareActualToTarget(actual, targetNum, method);
  const pct = comparable && actual != null && targetNum != null && targetNum !== 0
    ? (actual / targetNum) * 100
    : comparable && actual != null && targetNum === 0
      ? (actual === 0 ? 100 : null)
      : null;
  const performance = comparable ? computePerformanceStatus(targetNum, actual) : null;
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
    const indicatorText = String(ind.indicator_text || '');
    const expectsPercentOrRatio = indicatorExpectsPercent(indicatorText) || indicatorExpectsRatio(indicatorText);
    const method = methodForMetrics(metrics);
    const inputs = inputMetricsForIndicator(metrics);
    const byFy: Record<string, StrategyFyCell> = {};
    const getDeptVal = (deptId: number, metricId: number, year: string) =>
      getVal(indicatorId, deptId, metricId, year);

    for (const fy of fys) {
      const target = targetByKey.get(`${indicatorId}|${fy}`) ?? null;
      const derived = deriveFromCountMetrics(indicatorText, metrics, fy, assigned, getDeptVal);
      if (derived) {
        byFy[fy] = cellFromActual(
          derived.actual,
          target,
          derived.offices,
          derived.method,
          derived.display,
          derived.note,
        );
        continue;
      }
      if (method === 'not_numeric') {
        byFy[fy] = cellFromActual(null, target, 0, method, null, 'This indicator is text or mixed units, so it is not auto-totalled.');
        continue;
      }
      if (method === 'entered_percent' || method === 'entered_ratio') {
        const rolled = metricActualAcrossOffices(metrics, null, fy, assigned, getDeptVal);
        if (rolled.offices <= 1) {
          const looksLikeCount = method === 'entered_percent' && rolled.actual != null && rolled.actual > 150;
          byFy[fy] = cellFromActual(
            looksLikeCount ? null : rolled.actual,
            target,
            rolled.offices,
            method,
            looksLikeCount ? null : (method === 'entered_percent' && rolled.actual != null ? `${formatNumber(rolled.actual)}%` : null),
            looksLikeCount
              ? `The entered figure (${formatNumber(rolled.actual as number)}) looks like a count, not a percentage. Add a formula from the count cells (e.g. Female ÷ (Female + Male) × 100).`
              : rolled.offices === 1
                ? 'One office entered this value. Institutional % or ratio should be calculated from counts (Female and Male), not averaged across offices.'
                : null,
            !looksLikeCount,
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

      const rolled = metricActualAcrossOffices(metrics, null, fy, assigned, getDeptVal);
      const cellMethod: StrategyResultMethod = rolled.offices > 1 ? 'sum' : 'single';
      if (expectsPercentOrRatio) {
        const countNote = rolled.actual != null
          ? `Offices entered counts (total ${formatNumber(rolled.actual)}), not a percentage. This is not compared to the % target. Add a formula, e.g. filled posts ÷ establishment × 100, or Female ÷ (Female + Male) × 100.`
          : 'This is a % or ratio indicator. Add a formula from the count cells rather than summing raw counts against the target.';
        byFy[fy] = cellFromActual(null, target, rolled.offices, cellMethod, null, countNote, false);
        continue;
      }
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
      indicatorText,
      outcomeLabel: String(ind.outcome_label || ''),
      outcomeType: String(ind.outcome_type || ''),
      strategicPillar: ind.strategic_pillar != null ? String(ind.strategic_pillar) : null,
      pillarCode: ind.pillar_code != null ? String(ind.pillar_code) : null,
      assignedOffices: assigned.length,
      offices: assigned,
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
