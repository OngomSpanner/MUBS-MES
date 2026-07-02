/**
 * Financial year utilities for the questionnaire system.
 * FY runs July 1 → June 30 of the following year.
 * e.g. 2025/2026 = July 1 2025 – June 30 2026
 */

const FY_START_YEAR = 2024; // earliest FY in the system

/** Returns the start year of the current financial year (July-based). */
export function currentFyStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Formats a start year as the display FY string, e.g. 2024 → '2024/2025'. */
export function fyLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
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

/** Returns the current FY string, e.g. '2025/2026'. */
export function getCurrentFinancialYear(): string {
  return fyLabel(currentFyStartYear());
}

/** Parses a FY string like '2024/2025' into the start year number (2024). */
export function parseFyStartYear(fy: string): number | null {
  const m = String(fy).match(/^(\d{4})\/\d{4}$/);
  return m ? parseInt(m[1], 10) : null;
}

/** Canonical FY label for matching stored values (handles 2024/25 and 2024/2025). */
export function normalizeFinancialYear(fy: string): string {
  const s = String(fy).trim();
  const long = s.match(/^(\d{4})\/(\d{4})$/);
  if (long) return `${long[1]}/${long[2]}`;
  const short = s.match(/^(\d{4})\/(\d{2})$/);
  if (short) {
    const start = parseInt(short[1], 10);
    return `${start}/${start + 1}`;
  }
  return s;
}

/** Short FY display label, e.g. 2024/2025 → 2024/25 */
export function fyShortLabel(fy: string): string {
  const normalized = normalizeFinancialYear(fy);
  const m = normalized.match(/^(\d{4})\/(\d{4})$/);
  if (!m) return normalized;
  return `${m[1]}/${m[2].slice(-2)}`;
}
