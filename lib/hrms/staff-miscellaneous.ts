import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';

export type MiscellaneousMetricType =
  | 'staff_trainings'
  | 'hr_system_upgrades'
  | 'hr_development_plans'
  | 'hr_audits';

export const MISCELLANEOUS_METRICS: { value: MiscellaneousMetricType; label: string }[] = [
  { value: 'staff_trainings', label: 'Number of Staff Trainings Conducted' },
  { value: 'hr_system_upgrades', label: 'Number of system upgrades on HR system' },
  { value: 'hr_development_plans', label: 'No of HR development plans produced' },
  { value: 'hr_audits', label: 'No of HR audits conducted' },
];

export type MiscellaneousTableRow = {
  metricType: MiscellaneousMetricType;
  metricLabel: string;
  countsByYear: Record<string, number>;
};

export type StaffMiscellaneousReport = {
  yearKeys: string[];
  years: Record<string, string>;
  rows: MiscellaneousTableRow[];
};

async function loadAllCounts(
  yearKeys: string[]
): Promise<Map<MiscellaneousMetricType, Record<string, number>>> {
  const result = new Map<MiscellaneousMetricType, Record<string, number>>();
  for (const m of MISCELLANEOUS_METRICS) {
    result.set(m.value, Object.fromEntries(yearKeys.map((k) => [k, 0])));
  }
  if (yearKeys.length === 0) return result;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT metric_type, financial_year_key, count_value
        FROM staff_miscellaneous_counts
        WHERE financial_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as { metric_type: MiscellaneousMetricType; financial_year_key: string; count_value: number }[];

    for (const r of rows) {
      const byYear = result.get(r.metric_type);
      if (byYear) byYear[r.financial_year_key] = Number(r.count_value ?? 0);
    }
  } catch {
    // table may not exist yet
  }
  return result;
}

export async function generateStaffMiscellaneousReport(): Promise<StaffMiscellaneousReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);
  const countsByMetric = await loadAllCounts(yearKeys);

  const rows: MiscellaneousTableRow[] = MISCELLANEOUS_METRICS.map((m) => ({
    metricType: m.value,
    metricLabel: m.label,
    countsByYear: countsByMetric.get(m.value) ?? Object.fromEntries(yearKeys.map((k) => [k, 0])),
  }));

  return { yearKeys, years, rows };
}
