export const PROCESS_DURATION_UNIT_OPTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
] as const;

export type ProcessDurationUnit = (typeof PROCESS_DURATION_UNIT_OPTIONS)[number]['value'];

/**
 * Due date for a process task: start date plus the standard's duration (calendar).
 * Uses local-date arithmetic on YYYY-MM-DD to avoid UTC boundary shifts.
 */
export function addDurationToStartDate(
  startYmd: string,
  value: number | null | undefined,
  unit: string | null | undefined
): string {
  const v = value != null && Number.isFinite(Number(value)) ? Math.max(1, Math.floor(Number(value))) : 1;
  const u = String(unit || '').toLowerCase().trim();
  const parts = String(startYmd).slice(0, 10).split('-').map((x) => parseInt(x, 10));
  let y0: number;
  let m0: number;
  let d0: number;
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const d = new Date();
    y0 = d.getFullYear();
    m0 = d.getMonth() + 1;
    d0 = d.getDate();
  } else {
    [y0, m0, d0] = parts;
  }
  const date = new Date(y0, m0 - 1, d0);

  if (u === 'days') {
    date.setDate(date.getDate() + v);
  } else if (u === 'weeks') {
    date.setDate(date.getDate() + v * 7);
  } else if (u === 'months') {
    date.setMonth(date.getMonth() + v);
  } else if (u === 'quarterly') {
    date.setMonth(date.getMonth() + v * 3);
  } else if (u === 'annual') {
    date.setFullYear(date.getFullYear() + v);
  } else {
    date.setDate(date.getDate() + v);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatStandardProcessDuration(
  value: number | null | undefined,
  unit: string | null | undefined
): string {
  if (!unit || String(unit).trim() === '') return '';
  const v = value != null && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 1;
  const u = String(unit).toLowerCase();
  if (u === 'quarterly') return v <= 1 ? 'Quarterly' : `${v} quarters`;
  if (u === 'annual') return v <= 1 ? 'Annual' : `${v} years`;
  if (u === 'days') return `${v} day${v === 1 ? '' : 's'}`;
  if (u === 'weeks') return `${v} week${v === 1 ? '' : 's'}`;
  if (u === 'months') return `${v} month${v === 1 ? '' : 's'}`;
  return unit;
}
