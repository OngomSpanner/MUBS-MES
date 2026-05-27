export type FinancialYearLabel = `${number}/${number}`;

export type FinancialYearRange = {
  label: FinancialYearLabel;
  startYmd: string; // inclusive
  endYmd: string; // inclusive
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/**
 * Financial year boundaries for July–June.
 * Example: FY 2025/26 => 2025-07-01 .. 2026-06-30
 */
export function fyRangeJulyJune(label: string): FinancialYearRange | null {
  const t = String(label || '').trim().replace(/^FY\s+/i, '');
  const m = t.match(/^(\d{4})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const y1 = parseInt(m[1], 10);
  const y2 = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  if (y2 !== y1 + 1) return null;
  const startYmd = `${y1}-07-01`;
  const endYmd = `${y2}-06-30`;
  return { label: `${y1}/${String(y2).slice(-2)}` as FinancialYearLabel, startYmd, endYmd };
}

export function fyLabelForDateJulyJune(d: Date = new Date()): FinancialYearLabel {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const startYear = m >= 7 ? y : y - 1;
  const endYear2 = String(startYear + 1).slice(-2);
  return `${startYear}/${endYear2}` as FinancialYearLabel;
}

export function isDateInFyJulyJune(dateYmd: string, fyLabel: string): boolean {
  const r = fyRangeJulyJune(fyLabel);
  if (!r) return false;
  const ymd = String(dateYmd || '').slice(0, 10);
  return ymd >= r.startYmd && ymd <= r.endYmd;
}

export function formatFyRangeShort(range: FinancialYearRange | null): string {
  if (!range) return '—';
  return `${range.startYmd} → ${range.endYmd}`;
}

export function todayYmd(): string {
  return toYmd(new Date());
}

/** Entry for matrix reports (establishment, promotions): previous + current FY. */
export type FinancialYearWindowEntry = {
  key: string;
  label: FinancialYearLabel;
  start: string;
  end: string;
};

export function fyStartYearFromDate(d: Date = new Date()): number {
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 7 ? y : y - 1;
}

export function fyKey(startYear: number): string {
  const endShort = String(startYear + 1).slice(-2);
  return `${startYear}_${endShort}`;
}

export function buildFinancialYearWindowEntry(startYear: number): FinancialYearWindowEntry {
  const range = fyRangeJulyJune(`${startYear}/${String(startYear + 1).slice(-2)}`)!;
  return {
    key: fyKey(startYear),
    label: range.label,
    start: range.startYmd,
    end: range.endYmd,
  };
}

/** Previous + current financial year (oldest first) for HR matrix reports. */
export function getRollingReportFyWindow(asOf: Date = new Date()): FinancialYearWindowEntry[] {
  const currentStart = fyStartYearFromDate(asOf);
  return [
    buildFinancialYearWindowEntry(currentStart - 1),
    buildFinancialYearWindowEntry(currentStart),
  ];
}

export function labelsFromFyWindow(window: FinancialYearWindowEntry[]): Record<string, string> {
  return Object.fromEntries(window.map((y) => [y.key, y.label]));
}

/** Three academic years for staff development matrix (oldest first). */
export function getStaffDevelopmentAyWindow(asOf: Date = new Date()): FinancialYearWindowEntry[] {
  return getPastFinancialYearWindow(3, asOf);
}

/** Last N financial years including current (oldest first). Default 5 for recruitment report. */
export function getPastFinancialYearWindow(
  count = 5,
  asOf: Date = new Date()
): FinancialYearWindowEntry[] {
  const currentStart = fyStartYearFromDate(asOf);
  const years: FinancialYearWindowEntry[] = [];
  for (let i = count - 1; i >= 0; i--) {
    years.push(buildFinancialYearWindowEntry(currentStart - i));
  }
  return years;
}

