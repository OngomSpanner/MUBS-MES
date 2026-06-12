import { ACTIVITY_FY_TARGET_COLUMNS } from '@/lib/activity-fy-targets';
import { fyColumnKeyFromLabel } from '@/lib/rf-activity-targets';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';

export const RESULTS_FRAMEWORK_FY_OPTIONS = ACTIVITY_FY_TARGET_COLUMNS.map((c) => ({
  value: c.label.replace(/^FY\s+/, ''),
  label: c.label,
}));

export function parseResultsFrameworkFyParam(raw: string | null | undefined): string {
  const current = fyLabelForDateJulyJune();
  const t = String(raw || '').trim();
  if (!t) return current;
  return fyColumnKeyFromLabel(t) ? t : current;
}
