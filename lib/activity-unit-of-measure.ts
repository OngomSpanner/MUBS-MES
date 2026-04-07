/** How FY targets (and related KPI values) are expressed on strategic_activities.unit_of_measure */

export const ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS = [
  { value: 'numeric', label: 'Numeric' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'ratio', label: 'Ratio' },
  { value: 'currency', label: 'Currency' },
] as const;

export type ActivityFyUnitOfMeasure = (typeof ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS)[number]['value'];

const ALLOWED = new Set<string>(ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS.map((o) => o.value));

export function normalizeActivityUnitOfMeasure(raw: string | null | undefined): ActivityFyUnitOfMeasure {
  const v = String(raw ?? '').trim().toLowerCase();
  if (ALLOWED.has(v)) return v as ActivityFyUnitOfMeasure;
  if (v === 'percent' || v === '%') return 'percentage';
  if (v === 'money' || v === 'ugx' || v === 'usd') return 'currency';
  return 'numeric';
}

export function labelForActivityUnitOfMeasure(value: string | null | undefined): string {
  const v = normalizeActivityUnitOfMeasure(value);
  const opt = ACTIVITY_FY_UNIT_OF_MEASURE_OPTIONS.find((o) => o.value === v);
  return opt?.label ?? 'Numeric';
}

export function symbolForActivityUnitOfMeasure(value: string | null | undefined): string {
  switch (normalizeActivityUnitOfMeasure(value)) {
    case 'numeric':
      return '#';
    case 'percentage':
      return '%';
    case 'ratio':
      return ':';
    case 'currency':
      return 'UGX';
    default:
      return '#';
  }
}
