/**
 * @deprecated Use `lib/financial-year` — periods are July–June financial years.
 */
export {
  type FinancialYearWindowEntry as AcademicYearWindowEntry,
  buildFinancialYearWindowEntry as buildAcademicYearEntry,
  fyKey as academicYearKey,
  fyStartYearFromDate as academicYearStartFromDate,
  getRollingReportFyWindow as getEstablishmentAcademicYearWindow,
  labelsFromFyWindow as labelsFromWindow,
} from '@/lib/financial-year';
