/** True when `date` is the last calendar day of its month. */
export function isLastDayOfMonth(date = new Date()): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
}

/** Last day of the month containing `date` (local time). */
export function getLastDayOfMonthFor(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Next monthly sync date: last day of this month if not passed, else last day of next month. */
export function getNextMonthlySyncDate(from = new Date()): Date {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const thisMonthLast = getLastDayOfMonthFor(today);
  if (today.getTime() <= thisMonthLast.getTime()) return thisMonthLast;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return getLastDayOfMonthFor(nextMonth);
}

export function formatSyncDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const t = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatSyncDateTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const t = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
