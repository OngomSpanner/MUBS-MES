/**
 * M&E System — brief response to ambassador feedback (6 points, ~1 page).
 * Run: node scripts/generate-implementation-status-docx.js
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
const OUT_FILE = 'M_E_System_Implementation_Status_and_Access.docx';

function heading(text) {
  return new Paragraph({
    spacing: { before: 120, after: 50 },
    children: [new TextRun({ text, bold: true, size: 20 })],
  });
}

function line(label, text) {
  return new Paragraph({
    spacing: { after: 50 },
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 19 }),
      new TextRun({ text, size: 19 }),
    ],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 70 },
    children: [new TextRun({ text, size: 19 })],
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
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'MUBS M&E System', bold: true, size: 30 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: 'Response to Strategic Plan Ambassador Feedback',
                bold: true,
                size: 21,
              }),
              new TextRun({ text: `  |  ${dateStr}`, size: 18, italics: true }),
            ],
          }),

          body(
            'Brief status on the six agreed requirements: what is in place today, where to demonstrate it, and what remains.'
          ),

          heading('1. Strict data isolation between units'),
          line('Done:', 'Ambassadors see only their assigned unit; HODs see only their department tree; Strategy Manager sees university-wide data by design.'),
          line('Show:', 'Ambassador → Tracking or Reporting. HOD → any /department-head screen. Strategy Manager → /admin.'),
          line('Gap:', 'Principal role has no portal yet. Full isolation across every administrative view has not been fully audited.'),

          heading('2. Simplified ambassador interface'),
          line('Done:', 'Sidebar reduced to Tracking, Reporting, and Propose Changes. Detailed views are tabs inside Tracking and Reporting.'),
          line('Show:', 'Tracking → Dashboard, Activity progress, Results Framework, Milestones, Risk alerts. Reporting → Recruitment, Benefits, Workforce, Skills (+ Registrar enrollment; + HR staff profiles where assigned). Propose Changes → submit; Strategy Manager reviews at Admin → Ambassador Proposals.'),
          line('Gap:', 'Three sidebar items instead of two labels, but same two functions (Tracking + Reporting) plus proposals.'),

          heading('3. Results Framework as primary reporting benchmark'),
          line('Done:', 'Target, expected outcome, actual, and status (underperformance / achievement / overachievement). Ambassadors record outcome reasons and whether results came from existing practice or innovation. HOD and Strategy Manager have RF tables and Excel export; export is blocked until required ambassador narratives are complete.'),
          line('Show:', 'Ambassador → Tracking → Results Framework. HOD → Performance & Reports → Results Framework. Strategy Manager → Reports & Monitoring and Dashboard summary. Staff → Tasks → KPI report submission.'),
          line('Gap:', 'Actual values often empty until staff submit and HOD evaluates. Process reporting still runs alongside RF; RF is not yet the only reporting path for all activity types.'),

          heading('4. Automatic progress from standard milestones'),
          line('Done:', 'Process steps can carry cumulative milestone percentages. Parent activity progress updates automatically when HOD evaluates completed steps. HOD sees milestone panel on processes; ambassadors see Milestones tab and HOD-set due dates on activity progress.'),
          line('Show:', 'Strategy Manager → Standard and Activities (set step %). HOD → Processes (milestone panel); Strategic Activities (Due Date). Ambassador → Tracking → Milestones and Activity progress.'),
          line('Gap:', 'Milestone templates must be configured per standard (e.g. Project Proposal Development percentages are supported but not pre-loaded everywhere). Full automatic reports for cumulative progress, pending tasks, and historical performance across all units are not yet built; Performance Trends covers submission evaluation only.'),

          heading('5. Quantitative performance indicators'),
          line('Done:', 'Staff enter numeric values on KPI-type tasks. Registrar ambassadors record programme and course-unit enrollment disaggregated by faculty. Recruitment, benefits, workforce, and skills data can be entered per unit. Totals appear on ambassador and Strategy Manager dashboards.'),
          line('Show:', 'Staff → Tasks. Ambassador → Reporting (all tabs; Programmes and Course units for Registrar). Strategy Manager → Dashboard and Reports & Monitoring.'),
          line('Gap:', 'Not every activity has a numeric indicator. RF actuals and dashboards depend on data being entered and evaluated; auto-population from all sources is not complete.'),

          heading('6. HR boundaries — no replication of HRMS'),
          line('Done:', 'Full staff profiles restricted to HR Ambassador. Other ambassadors see names and departments only where needed for reporting. HOD Staff & Warnings shows name, designation, assignments, and workload status (on track, over-allocated, underutilized, falling behind) without contract, leave, or personal HR fields.'),
          line('Show:', 'HR Ambassador → Reporting → Staff profiles. HOD → Staff & Warnings. HOD → Processes (assignee names only).'),
          line('Gap:', 'Unit-head delegation to ambassador not implemented. No separate “overperforming” workload category. Ambassadors still see staff names in report dropdowns for data entry.'),

          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: 'Logins: ', bold: true, size: 19 }),
              new TextRun({
                text: 'Ambassador /ambassador  |  HOD /department-head  |  Strategy Manager /admin  |  Staff /staff',
                size: 19,
              }),
            ],
          }),
        ],
      },
    ],
  });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  const outPath = path.join(OUT_DIR, OUT_FILE);
  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
  console.log(`Wrote: ${outPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
