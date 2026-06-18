import { getPastFinancialYearWindow } from '@/lib/financial-year';

/** Academic year options for teaching data (stored in financial_year_key column). */
export function getAcademicYearOptions(count = 5) {
  return getPastFinancialYearWindow(count).map((y) => ({
    key: y.key,
    label: y.label,
  }));
}

export function academicYearLabelFromKey(key: string, years: { key: string; label: string }[]): string {
  return years.find((y) => y.key === key)?.label ?? key;
}
