import type { jsPDF } from 'jspdf';
import type { CellHookData, UserOptions } from 'jspdf-autotable';
import {
  formatOutcomeHeading,
  groupExportByDepartment,
  groupIndicatorsForExport,
  indicatorTargetForExport,
  type DepartmentExportBundle,
  type ExportDepartment,
  type ExportIndicator,
  type ExportScope,
  type GroupedExportSection,
} from '@/lib/questionnaire/export-questionnaire';
import { fyShortLabel } from '@/lib/questionnaire/fy-utils';
import { uomLabel } from '@/lib/questionnaire/uom';
import { buildExportFilename } from '@/lib/questionnaire/export-questionnaire';

type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;

const MUBS_BLUE: [number, number, number] = [0, 86, 150];
const MARGIN = 12;
const FOOTER_Y = 288;
const HEADER_H = 18;
const COL_NUM = 6;
const COL_UNIT = 14;
const COL_FY = 7;
const GAP_AFTER_HEADER = 4;
const GAP_AFTER_UNIT_BANNER = 9;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 6) {
    doc.addPage();
    return 14;
  }
  return y;
}

function addPageFooters(doc: jsPDF, unitLabel: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 3, pageWidth - MARGIN, FOOTER_Y - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    const left = unitLabel ? `MUBS M&E Questionnaire · ${unitLabel}` : 'MUBS M&E Questionnaire';
    doc.text(left, MARGIN, FOOTER_Y);
    doc.text(`Page ${i} of ${total}`, pageWidth - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function drawDocumentHeader(
  doc: jsPDF,
  pageWidth: number,
  unitName: string | null,
  showUnitInHeader: boolean,
): number {
  doc.setFillColor(...MUBS_BLUE);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('MUBS M&E — Performance Questionnaire', MARGIN, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (showUnitInHeader && unitName) {
    doc.text(unitName, MARGIN, 15);
  }
  doc.text(new Date().toLocaleDateString(), pageWidth - MARGIN, 14, { align: 'right' });
  return HEADER_H + GAP_AFTER_HEADER;
}

function drawUnitBanner(doc: jsPDF, pageWidth: number, unitName: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  const boxH = 8;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...MUBS_BLUE);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, y, pageWidth - MARGIN * 2, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUBS_BLUE);
  doc.text(unitName, MARGIN + 2.5, y + 5.2);
  return y + boxH + GAP_AFTER_UNIT_BANNER;
}

function renderIndicatorTable(
  doc: jsPDF,
  autoTable: AutoTableFn,
  pageWidth: number,
  ind: ExportIndicator,
  y: number,
): number {
  const fys = [...ind.financial_years];
  const metrics = [...ind.metrics].sort((a, b) => a.sort_order - b.sort_order);
  const fyLabels = fys.map(fyShortLabel);
  const targetCells = fys.map((fy) => {
    const t = indicatorTargetForExport(ind.targets, fy);
    return t ? `T:${t}` : '';
  });
  const hasTargets = targetCells.some((c) => c);

  y = ensureSpace(doc, y, 14 + metrics.length * 5);

  const head: string[][] = [
    ['#', 'Performance metric', 'Unit', ...fyLabels],
  ];
  if (hasTargets) {
    head.push(['', '', '', ...targetCells]);
  }

  const body = metrics.map((m, i) => [
    String(i + 1),
    m.metric_text,
    uomLabel(m.unit_of_measure),
    ...fys.map(() => ''),
  ]);

  const tableWidth = pageWidth - MARGIN * 2;
  const fixedWidth = COL_NUM + COL_UNIT + fys.length * COL_FY;
  const metricWidth = Math.max(40, tableWidth - fixedWidth);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 14 },
    tableWidth,
    head,
    body,
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.2, right: 1, bottom: 1.2, left: 1 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [210, 218, 226],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: MUBS_BLUE,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      cellPadding: { top: 1, right: 0.8, bottom: 1, left: 0.8 },
    },
    columnStyles: {
      0: { cellWidth: COL_NUM, halign: 'center' },
      1: { cellWidth: metricWidth, halign: 'left' },
      2: { cellWidth: COL_UNIT, halign: 'center', fontSize: 5.5, overflow: 'linebreak' },
      ...Object.fromEntries(
        fyLabels.map((_, idx) => [
          idx + 3,
          { cellWidth: COL_FY, halign: 'center', fontSize: 5.5, overflow: 'hidden' },
        ]),
      ),
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === 'head' && data.row.index === 1) {
        data.cell.styles.fillColor = [255, 248, 220];
        data.cell.styles.textColor = [140, 95, 0];
        data.cell.styles.fontSize = 6;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.cellPadding = { top: 0.8, right: 0.5, bottom: 0.8, left: 0.5 };
      }
      if (data.section === 'body' && data.column.index >= 3) {
        data.cell.styles.minCellHeight = 5;
      }
      if (data.section === 'body' && data.column.index === 2) {
        data.cell.styles.minCellHeight = 5;
      }
    },
    theme: 'grid',
    showHead: 'everyPage',
  });

  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
}

function renderIndicatorBlock(
  doc: jsPDF,
  autoTable: AutoTableFn,
  pageWidth: number,
  ind: ExportIndicator,
  y: number,
): number {
  y = ensureSpace(doc, y, 16);
  const boxW = pageWidth - MARGIN * 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.2);
  const titleLines = doc.splitTextToSize(ind.indicator_text, boxW - 6);
  const boxH = titleLines.length * 3.4 + 3.5;
  doc.roundedRect(MARGIN, y, boxW, boxH, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(titleLines, MARGIN + 2.5, y + 3.5);

  y += boxH + 1.5;
  return renderIndicatorTable(doc, autoTable, pageWidth, ind, y) + 3;
}

function renderSections(
  doc: jsPDF,
  autoTable: AutoTableFn,
  pageWidth: number,
  sections: GroupedExportSection[],
  startY: number,
): number {
  let y = startY;

  for (const section of sections) {
    y = ensureSpace(doc, y, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUBS_BLUE);
    doc.text(section.objectiveTitle, MARGIN, y);
    y += 5;

    for (const outcome of section.outcomes) {
      y = ensureSpace(doc, y, 10);
      doc.setFillColor(...MUBS_BLUE);
      doc.rect(MARGIN, y - 2.2, 1.2, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      const heading = formatOutcomeHeading(outcome.outcomeType, outcome.outcomeLabel);
      const lines = doc.splitTextToSize(heading, pageWidth - MARGIN * 2 - 5);
      doc.text(lines, MARGIN + 4, y);
      y += lines.length * 3 + 3;

      for (const ind of outcome.indicators) {
        y = renderIndicatorBlock(doc, autoTable, pageWidth, ind, y);
      }
    }
    y += 1;
  }

  return y;
}

export type QuestionnairePdfOptions = {
  scope: ExportScope;
  unitName?: string;
  unitId?: number;
  indicators: ExportIndicator[];
  departments: ExportDepartment[];
};

export async function downloadQuestionnairePdf(options: QuestionnairePdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerUnit = options.scope === 'department' ? options.unitName ?? null : null;

  if (options.scope === 'department' && options.unitName) {
    const y = drawDocumentHeader(doc, pageWidth, options.unitName, true);
    const sections = groupIndicatorsForExport(options.indicators);
    renderSections(doc, autoTable, pageWidth, sections, y);
  } else {
    const bundles = groupExportByDepartment(options.indicators, options.departments);
    let first = true;

    for (const bundle of bundles) {
      if (!first) doc.addPage();
      first = false;
      let y = drawDocumentHeader(doc, pageWidth, null, false);
      y = drawUnitBanner(doc, pageWidth, bundle.department.name, y);
      renderSections(doc, autoTable, pageWidth, bundle.sections, y);
    }

    if (bundles.length === 0) {
      drawDocumentHeader(doc, pageWidth, null, false);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('No questionnaire data to export.', MARGIN, 40);
    }
  }

  addPageFooters(doc, footerUnit);
  doc.save(buildExportFilename(options.scope, options.unitName, 'pdf'));
}

export type { DepartmentExportBundle };
