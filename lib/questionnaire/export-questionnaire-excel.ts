import * as XLSX from 'xlsx';
import {
  buildExportFilename,
  buildQuestionnaireMetricRows,
  EXCEL_COLUMN_WIDTHS,
  filterIndicatorsByDepartment,
  groupExportByDepartment,
  sanitizeSheetName,
  type ExportDepartment,
  type ExportIndicator,
  type ExportScope,
  type QuestionnaireMetricRow,
} from '@/lib/questionnaire/export-questionnaire';

function applySheetFormatting(ws: XLSX.WorkSheet, rows: QuestionnaireMetricRow[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map((h) => ({ wch: EXCEL_COLUMN_WIDTHS[h] ?? 16 }));
}

function rowsToSheet(rows: QuestionnaireMetricRow[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetFormatting(ws, rows);
  return ws;
}

export type QuestionnaireExcelOptions = {
  scope: ExportScope;
  unitName?: string;
  indicators: ExportIndicator[];
  departments: ExportDepartment[];
};

export function downloadQuestionnaireExcel(options: QuestionnaireExcelOptions): void {
  const wb = XLSX.utils.book_new();

  if (options.scope === 'department') {
    const rows = buildQuestionnaireMetricRows(options.indicators, { omitResponsibleUnits: true });
    XLSX.utils.book_append_sheet(wb, rowsToSheet(rows), sanitizeSheetName(options.unitName ?? 'Unit'));
    XLSX.writeFile(wb, buildExportFilename('department', options.unitName, 'xlsx'));
    return;
  }

  const bundles = groupExportByDepartment(options.indicators, options.departments);
  const usedNames = new Set<string>();

  for (const bundle of bundles) {
    let sheetName = sanitizeSheetName(bundle.department.name);
    let suffix = 1;
    while (usedNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${bundle.department.name} ${suffix}`);
      suffix += 1;
    }
    usedNames.add(sheetName);

    const deptIndicators = filterIndicatorsByDepartment(options.indicators, bundle.department.id);
    const rows = buildQuestionnaireMetricRows(deptIndicators, { omitResponsibleUnits: true });
    XLSX.utils.book_append_sheet(wb, rowsToSheet(rows), sheetName);
  }

  if (bundles.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No questionnaire data']]), 'Empty');
  }

  XLSX.writeFile(wb, buildExportFilename('all', undefined, 'xlsx'));
}
