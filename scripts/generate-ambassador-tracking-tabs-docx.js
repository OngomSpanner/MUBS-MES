/**
 * Ambassador Tracking tabs guide (Dashboard, Activity progress, Results Framework).
 * Run: node scripts/generate-ambassador-tracking-tabs-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} = require('docx');

const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_System_Ambassador_Tracking_Tabs_Guide.docx';

function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, color: '666666' })],
  });
}

function heading(text) {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 70 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 50 },
    indent: { left: 360 },
    children: [new TextRun({ text: `• ${text}`, size: 20 })],
  });
}

async function run() {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const doc = new Document({
    sections: [
      {
        children: [
          title('MUBS M&E System — Ambassador Tracking Tabs'),
          subtitle(`Generated: ${dateStr}`),
          body(
            'Under Tracking, ambassadors use three tabs: Dashboard, Activity progress, and Results Framework. Each answers a different monitoring question for the department or unit (e.g. E-LEARNING).',
          ),

          heading('1. Dashboard'),
          body(
            'At-a-glance summary of the managed unit. Shows overall strategic progress, activity counts (on track, in progress, delayed), monthly staff reporting rate, Results Framework snapshot, and quick links to other areas.',
          ),
          bullet('Use for: “How is my unit doing overall?”'),

          heading('2. Activity progress (Dept. / Unit Progress)'),
          body(
            'Operational tracking of strategic activities. Shows progress bars, milestone tasks, status (on track / in progress / delayed), due dates, and activities requiring attention. Includes filters, monthly reporting context, and PDF/Excel export.',
          ),
          bullet('Use for: “Are we doing the work on time?” — implementation and compliance.'),

          heading('3. Results Framework'),
          body(
            'Performance against plan targets over the strategic period. Matrix columns: Result (expected outcome), Indicator, Baseline (2024/2025), Target and Actual for each financial year (2025/2026–2029/2030), Status for the current FY, and Outcome narrative.',
          ),
          bullet(
            'Status: Underperformance (<90% of target), Achievement (90–110%), Overachievement (>110%), or Not assessed when actual data is missing for the FY.',
          ),
          bullet(
            'When assessed, ambassadors record why (outcome narrative). If on or above target, they indicate existing practice (maintain) or innovation (document and share).',
          ),
          bullet('Use for: “Did we hit our indicator targets, and why?” — M&E reporting.'),

          heading('Quick comparison'),
          bullet('Dashboard → overall health of the unit'),
          bullet('Activity progress → schedule and milestone delivery'),
          bullet('Results Framework → target vs actual and explanatory narratives'),

          body(
            'Note: “Not assessed” in Results Framework means a target or actual value is missing for the current financial year — enter actual performance via Reporting (questionnaire / indicator data) before status can be calculated.',
          ),
        ],
      },
    ],
  });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const outPath = path.join(OUT_DIR, OUT_FILE);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved: ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
