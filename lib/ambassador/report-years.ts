import { getPastFinancialYearWindow } from '@/lib/financial-year';

export function getAmbassadorReportYearOptions() {
  return getPastFinancialYearWindow(5).map((y) => ({
    key: y.key,
    label: y.label,
  }));
}
