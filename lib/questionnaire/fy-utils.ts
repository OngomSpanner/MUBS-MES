/**
 * Financial year utilities for the questionnaire system.
 * FY runs July 1 → June 30 of the following year.
 * e.g. 2025/2026 = July 1 2025 – June 30 2026
 *
 * Quarters (MUBS FY):
 *   Q1 Jul–Sep (ends September)
 *   Q2 Oct–Dec
 *   Q3 Jan–Mar
 *   Q4 Apr–Jun
 * Stored as e.g. 2026/2027-Q1
 */

const FY_START_YEAR = 2024; // earliest FY in the system

export type FyQuarter = 1 | 2 | 3 | 4;

const QUARTER_META: Record<FyQuarter, { months: string; endMonth: string; startCalendarYearOffset: number }> = {
  1: { months: 'Jul–Sep', endMonth: 'September', startCalendarYearOffset: 0 },
  2: { months: 'Oct–Dec', endMonth: 'December', startCalendarYearOffset: 0 },
  3: { months: 'Jan–Mar', endMonth: 'March', startCalendarYearOffset: 1 },
  4: { months: 'Apr–Jun', endMonth: 'June', startCalendarYearOffset: 1 },
};

/** Returns the start year of the current financial year (July-based). */
export function currentFyStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Formats a start year as the display FY string, e.g. 2024 → '2024/2025'. */
export function fyLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

export function fyQuarterKey(startYear: number, quarter: FyQuarter): string {
  return `${fyLabel(startYear)}-Q${quarter}`;
}

/** Returns all available financial years from FY_START_YEAR up to current FY. */
export function getAvailableFinancialYears(): string[] {
  const maxYear = currentFyStartYear();
  const years: string[] = [];
  for (let y = FY_START_YEAR; y <= maxYear; y++) {
    years.push(fyLabel(y));
  }
  return years;
}

/** Q1–Q4 of the current FY (Q1 ends September). */
export function getCurrentFyQuarterPeriods(): string[] {
  const y = currentFyStartYear();
  return ([1, 2, 3, 4] as FyQuarter[]).map((q) => fyQuarterKey(y, q));
}

/** Annual FYs plus current-FY quarters, for questionnaire period pickers. */
export function getAvailableReportingPeriods(): string[] {
  return [...getAvailableFinancialYears(), ...getCurrentFyQuarterPeriods()];
}

/** Returns the current FY string, e.g. '2025/2026'. */
export function getCurrentFinancialYear(): string {
  return fyLabel(currentFyStartYear());
}

/** Parses a FY string like '2024/2025' into the start year number (2024). */
export function parseFyStartYear(fy: string): number | null {
  const normalized = normalizeFinancialYear(fy);
  const m = normalized.match(/^(\d{4})\/\d{4}(?:-Q[1-4])?$/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseFyQuarter(period: string): FyQuarter | null {
  const normalized = normalizeFinancialYear(period);
  const m = normalized.match(/-Q([1-4])$/);
  if (!m) return null;
  return Number(m[1]) as FyQuarter;
}

export function isQuarterPeriod(period: string): boolean {
  return parseFyQuarter(period) != null;
}

/** Canonical FY label for matching stored values (handles 2024/25, 2024/2025, and 2026/27-Q1). */
export function normalizeFinancialYear(fy: string): string {
  const s = String(fy).trim();
  const quarter = s.match(/^(\d{4})\s*\/\s*(\d{2}|\d{4})\s*-?\s*Q([1-4])$/i);
  if (quarter) {
    const start = parseInt(quarter[1], 10);
    return fyQuarterKey(start, Number(quarter[3]) as FyQuarter);
  }
  const long = s.match(/^(\d{4})\/(\d{4})$/);
  if (long) return `${long[1]}/${long[2]}`;
  const short = s.match(/^(\d{4})\/(\d{2})$/);
  if (short) {
    const start = parseInt(short[1], 10);
    return `${start}/${start + 1}`;
  }
  return s;
}

/** Short FY display label, e.g. 2024/2025 → 2024/25, 2026/2027-Q1 → 2026/27 Q1 */
export function fyShortLabel(fy: string): string {
  const normalized = normalizeFinancialYear(fy);
  const q = parseFyQuarter(normalized);
  const m = normalized.match(/^(\d{4})\/(\d{4})/);
  if (!m) return normalized;
  const annual = `${m[1]}/${m[2].slice(-2)}`;
  return q ? `${annual} Q${q}` : annual;
}

/** Extra hint for quarter buttons, e.g. "Jul–Sep 2026 · ends September". */
export function reportingPeriodHint(period: string): string | null {
  const normalized = normalizeFinancialYear(period);
  const q = parseFyQuarter(normalized);
  const startYear = parseFyStartYear(normalized);
  if (!q || startYear == null) return null;
  const meta = QUARTER_META[q];
  const calendarYear = startYear + meta.startCalendarYearOffset;
  return `${meta.months} ${calendarYear} · ends ${meta.endMonth}`;
}
