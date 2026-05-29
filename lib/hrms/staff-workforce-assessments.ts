import { query } from '@/lib/db';
import { getRollingReportFyWindow, labelsFromFyWindow } from '@/lib/financial-year';

export type WorkforceAssessmentRow = {
  assessmentDetail: string;
  countsByYear: Record<string, number>;
};

export type StaffWorkforceAssessmentsReport = {
  yearKeys: string[];
  years: Record<string, string>;
  rows: WorkforceAssessmentRow[];
};

async function loadAssessmentCounts(
  yearKeys: string[],
  managedUnitId?: number | null
): Promise<Map<string, Record<string, number>>> {
  const byDetail = new Map<string, Record<string, number>>();
  if (yearKeys.length === 0) return byDetail;

  const placeholders = yearKeys.map(() => '?').join(',');
  const unitClause =
    managedUnitId != null
      ? ' AND managed_unit_id = ?'
      : ' AND managed_unit_id IS NULL';
  const values: (string | number)[] = [...yearKeys];
  if (managedUnitId != null) values.push(managedUnitId);

  try {
    const rows = (await query({
      query: `
        SELECT assessment_detail, financial_year_key, count_value
        FROM staff_workforce_assessment_counts
        WHERE financial_year_key IN (${placeholders})${unitClause}
        ORDER BY assessment_detail ASC
      `,
      values,
    })) as { assessment_detail: string; financial_year_key: string; count_value: number }[];

    for (const r of rows) {
      const detail = (r.assessment_detail || '').trim();
      if (!detail) continue;
      if (!byDetail.has(detail)) {
        byDetail.set(detail, Object.fromEntries(yearKeys.map((k) => [k, 0])));
      }
      byDetail.get(detail)![r.financial_year_key] = Number(r.count_value ?? 0);
    }
  } catch {
    // table may not exist yet
  }
  return byDetail;
}

export async function generateStaffWorkforceAssessmentsReport(options?: {
  managedUnitId?: number | null;
}): Promise<StaffWorkforceAssessmentsReport> {
  const window = getRollingReportFyWindow();
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromFyWindow(window);
  const byDetail = await loadAssessmentCounts(yearKeys, options?.managedUnitId);

  const rows: WorkforceAssessmentRow[] = Array.from(byDetail.entries())
    .map(([assessmentDetail, countsByYear]) => ({ assessmentDetail, countsByYear }))
    .sort((a, b) =>
      a.assessmentDetail.localeCompare(b.assessmentDetail, undefined, { sensitivity: 'base' })
    );

  return { yearKeys, years, rows };
}
