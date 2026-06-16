/**
 * SDS (Service Delivery Standard) extended fields on the standards table.
 */

export type StandardSdsPayload = {
  standard_no: string;
  user_fee: string | null;
  standard_owner: string;
  supporting_units: string | null;
  pathway: string | null;
  process_standard: string | null;
  time_standard: string | null;
  accessibility: string | null;
  coverage: string | null;
  frequency: string | null;
  target_beneficiary: string | null;
  access_criteria: string | null;
  methodology: string | null;
  inputs: string | null;
  performance_indicators: string[];
};

export const STANDARD_SDS_SELECT_COLUMNS = [
  'standard_no',
  'user_fee',
  'standard_owner',
  'supporting_units',
  'pathway',
  'process_standard',
  'time_standard',
  'accessibility',
  'coverage',
  'frequency',
  'target_beneficiary',
  'access_criteria',
  'methodology',
  'inputs',
  'performance_indicators',
] as const;

export const STANDARD_BASE_SELECT_COLUMNS = [
  'id',
  'title',
  'quality_standard',
  'output_standard',
  'performance_indicator',
  'duration_value',
  'duration_unit',
  'target',
  'created_at',
] as const;

export function buildStandardsSelectSql(): string {
  return [...STANDARD_BASE_SELECT_COLUMNS, ...STANDARD_SDS_SELECT_COLUMNS].join(', ');
}

export function formatUserFeeDisplay(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim();
  return v || 'Not Applicable';
}

export function parsePerformanceIndicatorsFromRow(row: Record<string, unknown>): string[] {
  const raw = row.performance_indicators;
  if (raw != null && raw !== '') {
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x).trim()).filter(Boolean);
        }
      } catch {
        // fall through
      }
    }
  }
  const legacy = row.performance_indicator;
  if (legacy != null && String(legacy).trim() !== '') {
    return String(legacy)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function performanceIndicatorLegacyText(indicators: string[]): string | null {
  const list = indicators.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return list.join('\n');
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function parsePerformanceIndicatorsPayload(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof body === 'string' && body.trim()) {
    return body
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseStandardSdsFromBody(body: Record<string, unknown>): StandardSdsPayload & {
  title: string;
  quality_standard: string;
  output_standard: string;
  performance_indicator: string | null;
  duration_value: number | null;
  duration_unit: string;
} {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const quality = typeof body.quality_standard === 'string' ? body.quality_standard.trim() : '';
  const output = typeof body.output_standard === 'string' ? body.output_standard.trim() : '';
  const standard_no = typeof body.standard_no === 'string' ? body.standard_no.trim() : '';

  const indicators = parsePerformanceIndicatorsPayload(body.performance_indicators);
  const legacyPi =
    typeof body.performance_indicator === 'string' ? body.performance_indicator.trim() : '';
  const mergedIndicators =
    indicators.length > 0
      ? indicators
      : legacyPi
        ? legacyPi.split(/\n+/).map((s) => s.trim()).filter(Boolean)
        : [];

  const unit =
    typeof body.duration_unit === 'string' ? body.duration_unit.trim().toLowerCase() : '';
  const dvNum =
    body.duration_value != null && body.duration_value !== ''
      ? parseInt(String(body.duration_value), 10)
      : null;

  return {
    title,
    standard_no,
    user_fee: trimOrNull(body.user_fee),
    standard_owner: typeof body.standard_owner === 'string' ? body.standard_owner.trim() : '',
    supporting_units: trimOrNull(body.supporting_units),
    pathway: trimOrNull(body.pathway),
    quality_standard: quality,
    output_standard: output,
    performance_indicators: mergedIndicators,
    performance_indicator: performanceIndicatorLegacyText(mergedIndicators),
    process_standard: trimOrNull(body.process_standard),
    time_standard: trimOrNull(body.time_standard),
    accessibility: trimOrNull(body.accessibility),
    coverage: trimOrNull(body.coverage),
    frequency: trimOrNull(body.frequency),
    target_beneficiary: trimOrNull(body.target_beneficiary),
    access_criteria: trimOrNull(body.access_criteria),
    methodology: trimOrNull(body.methodology),
    inputs: trimOrNull(body.inputs),
    duration_value: dvNum,
    duration_unit: unit,
  };
}

export function sdsFieldsFromRow(row: Record<string, unknown>): StandardSdsPayload & {
  user_fee_display: string;
} {
  const indicators = parsePerformanceIndicatorsFromRow(row);
  return {
    standard_no: String(row.standard_no ?? '').trim(),
    user_fee: trimOrNull(row.user_fee),
    user_fee_display: formatUserFeeDisplay(trimOrNull(row.user_fee)),
    standard_owner: String(row.standard_owner ?? '').trim(),
    supporting_units: trimOrNull(row.supporting_units),
    pathway: trimOrNull(row.pathway),
    process_standard: trimOrNull(row.process_standard),
    time_standard: trimOrNull(row.time_standard),
    accessibility: trimOrNull(row.accessibility),
    coverage: trimOrNull(row.coverage),
    frequency: trimOrNull(row.frequency),
    target_beneficiary: trimOrNull(row.target_beneficiary),
    access_criteria: trimOrNull(row.access_criteria),
    methodology: trimOrNull(row.methodology),
    inputs: trimOrNull(row.inputs),
    performance_indicators: indicators,
  };
}

export function emptySdsFields(): StandardSdsPayload & { user_fee_display: string } {
  return {
    standard_no: '',
    user_fee: null,
    user_fee_display: 'Not Applicable',
    standard_owner: '',
    supporting_units: null,
    pathway: null,
    process_standard: null,
    time_standard: null,
    accessibility: null,
    coverage: null,
    frequency: null,
    target_beneficiary: null,
    access_criteria: null,
    methodology: null,
    inputs: null,
    performance_indicators: [],
  };
}
