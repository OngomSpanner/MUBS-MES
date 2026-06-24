/**
 * Ambassador Tracking tabs guide (Dashboard, Activity progress, Results Framework).
 * Run: node scripts/generate-ambassador-tracking-tabs-pdf.js
 */
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_System_Ambassador_Tracking_Tabs_Guide.pdf';

function wrapText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sectionTitle(doc, title, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 92, 164);
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  return y + 7;
}

function bodyParagraph(doc, text, y, maxWidth) {
  return wrapText(doc, text, 14, y, maxWidth, 5) + 4;
}

function bullet(doc, text, y, maxWidth) {
  return wrapText(doc, `• ${text}`, 18, y, maxWidth - 4, 5) + 2;
}

function run() {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const maxWidth = 182;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 92, 164);
  doc.text('MUBS M&E System — Ambassador Tracking Tabs', 105, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${dateStr}`, 105, y, { align: 'center' });
  y += 12;

  doc.setTextColor(30, 30, 30);
  y = bodyParagraph(
    doc,
    'Under Tracking, ambassadors use three tabs: Dashboard, Activity progress, and Results Framework. Each answers a different monitoring question for the department or unit (e.g. E-LEARNING).',
    y,
    maxWidth,
  );

  y = sectionTitle(doc, '1. Dashboard', y);
  y = bodyParagraph(
    doc,
    'At-a-glance summary of the managed unit. Shows overall strategic progress, activity counts (on track, in progress, delayed), monthly staff reporting rate, Results Framework snapshot, and quick links to other areas.',
    y,
    maxWidth,
  );
  y = bullet(doc, 'Use for: “How is my unit doing overall?”', y, maxWidth);
  y += 4;

  y = sectionTitle(doc, '2. Activity progress (Dept. / Unit Progress)', y);
  y = bodyParagraph(
    doc,
    'Operational tracking of strategic activities. Shows progress bars, milestone tasks, status (on track / in progress / delayed), due dates, and activities requiring attention. Includes filters, monthly reporting context, and PDF/Excel export.',
    y,
    maxWidth,
  );
  y = bullet(doc, 'Use for: “Are we doing the work on time?” — implementation and compliance.', y, maxWidth);
  y += 4;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  y = sectionTitle(doc, '3. Results Framework', y);
  y = bodyParagraph(
    doc,
    'Performance against plan targets over the strategic period. Matrix columns: Result (expected outcome), Indicator, Baseline (2024/2025), Target and Actual for each financial year (2025/2026–2029/2030), Status for the current FY, and Outcome narrative.',
    y,
    maxWidth,
  );
  y = bullet(
    doc,
    'Status: Underperformance (<90% of target), Achievement (90–110%), Overachievement (>110%), or Not assessed when actual data is missing for the FY.',
    y,
    maxWidth,
  );
  y = bullet(
    doc,
    'When assessed, ambassadors record why (outcome narrative). If on or above target, they indicate existing practice (maintain) or innovation (document and share).',
    y,
    maxWidth,
  );
  y = bullet(doc, 'Use for: “Did we hit our indicator targets, and why?” — M&E reporting.', y, maxWidth);
  y += 6;

  y = sectionTitle(doc, 'Quick comparison', y);
  y = bullet(doc, 'Dashboard → overall health of the unit', y, maxWidth);
  y = bullet(doc, 'Activity progress → schedule and milestone delivery', y, maxWidth);
  y = bullet(doc, 'Results Framework → target vs actual and explanatory narratives', y, maxWidth);
  y += 4;

  y = bodyParagraph(
    doc,
    'Note: “Not assessed” in Results Framework means a target or actual value is missing for the current financial year — enter actual performance via Reporting (questionnaire / indicator data) before status can be calculated.',
    y,
    maxWidth,
  );

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const outPath = path.join(OUT_DIR, OUT_FILE);
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved: ${outPath}`);
}

run();
