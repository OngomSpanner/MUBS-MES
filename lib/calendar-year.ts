/** Calendar (normal) year: 1 Jan – 31 Dec. */

export type CalendarYearWindowEntry = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export function buildCalendarYearEntry(year: number): CalendarYearWindowEntry {
  return {
    key: String(year),
    label: String(year),
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

/** Last N calendar years including current (oldest first). Default 5 for recruitment report. */
export function getPastCalendarYearWindow(
  count = 5,
  asOf: Date = new Date()
): CalendarYearWindowEntry[] {
  const currentYear = asOf.getFullYear();
  const years: CalendarYearWindowEntry[] = [];
  for (let i = count - 1; i >= 0; i--) {
    years.push(buildCalendarYearEntry(currentYear - i));
  }
  return years;
}

export function labelsFromCalendarWindow(
  window: CalendarYearWindowEntry[]
): Record<string, string> {
  return Object.fromEntries(window.map((y) => [y.key, y.label]));
}

export function recruitedInCalendarYear(
  dateYmd: string | null,
  year: CalendarYearWindowEntry
): boolean {
  if (!dateYmd) return false;
  const d = dateYmd.slice(0, 10);
  return d >= year.start && d <= year.end;
}
