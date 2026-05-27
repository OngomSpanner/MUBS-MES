import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';

export type EmploymentSkillYearCell = {
  yearKey: string;
  yearLabel: string;
  reportsProduced: number;
  skillsMissing: number;
};

export type StaffEmploymentSkillStatusReport = {
  yearKeys: string[];
  years: Record<string, string>;
  byYear: EmploymentSkillYearCell[];
};

async function loadYearCounts(yearKeys: string[]): Promise<Map<string, { reportsProduced: number; skillsMissing: number }>> {
  const result = new Map<string, { reportsProduced: number; skillsMissing: number }>();
  for (const key of yearKeys) {
    result.set(key, { reportsProduced: 0, skillsMissing: 0 });
  }
  if (yearKeys.length === 0) return result;

  const placeholders = yearKeys.map(() => '?').join(',');
  try {
    const rows = (await query({
      query: `
        SELECT financial_year_key, reports_produced, skills_missing
        FROM staff_employment_skill_status
        WHERE financial_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as { financial_year_key: string; reports_produced: number; skills_missing: number }[];

    for (const r of rows) {
      result.set(r.financial_year_key, {
        reportsProduced: Number(r.reports_produced ?? 0),
        skillsMissing: Number(r.skills_missing ?? 0),
      });
    }
  } catch {
    // table may not exist yet
  }
  return result;
}

export async function generateStaffEmploymentSkillStatusReport(): Promise<StaffEmploymentSkillStatusReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);
  const counts = await loadYearCounts(yearKeys);

  const byYear: EmploymentSkillYearCell[] = window.map((y) => {
    const c = counts.get(y.key) ?? { reportsProduced: 0, skillsMissing: 0 };
    return {
      yearKey: y.key,
      yearLabel: y.label,
      reportsProduced: c.reportsProduced,
      skillsMissing: c.skillsMissing,
    };
  });

  return { yearKeys, years, byYear };
}
