/**
 * Summary of Strategic Plan Ambassador feedback on the M&E system.
 * Run: node scripts/generate-ambassador-feedback-summary-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require('docx');

const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_System_Ambassador_Feedback_Summary.docx';

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22 })],
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
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'MUBS M&E System — Ambassador Feedback Summary',
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [new TextRun({ text: dateStr, size: 22, italics: true })],
          }),

          sectionHeading('What the feedback means'),
          body(
            'Feedback from a Strategic Plan Ambassador calls for a more secure, simpler, and results-focused M&E system. The system should enforce strict unit-level data isolation, simplify the ambassador interface around reporting and tracking, align reporting with the Results Framework, automate progress from milestones, support quantitative indicators, and respect HR system boundaries by limiting sensitive staff data.'
          ),

          sectionHeading('1. Strict data isolation between units'),
          body(
            'Meaning: An ambassador assigned to one unit must not see activities or data belonging to other units (e.g. HR seeing Strategy & Projects data, or vice versa). Access should be limited to the assigned Strategic Plan Ambassador, Head of Department (HOD), Strategy & Projects Planner, and Principal.'
          ),
          body('What will be done:'),
          bullet('Enforce unit-based scoping on all ambassador and related APIs and screens.'),
          bullet('Filter queries by managed unit / assigned department tree only.'),
          bullet('Audit activity progress, staff lists, and reports for cross-unit data leaks.'),

          sectionHeading('2. Simplify ambassador navigation'),
          body(
            'Meaning: The ambassador sidebar is too complex. Navigation should focus on two primary functions — Reporting and Tracking — plus a dedicated area for ambassadors to propose structural or data changes.'
          ),
          body('What will be done:'),
          bullet('Redesign ambassador menu to group features under Reporting and Tracking.'),
          bullet('Add a “Propose changes” or feedback module for ambassadors to request system or data updates.'),

          sectionHeading('3. Results Framework as the reporting benchmark'),
          body(
            'Meaning: Reporting should be driven by the Results Framework (targets, expected outcomes, actual performance). Performance should be classified as underperformance, achievement, or overachievement. Users must provide reasons and indicate whether results came from existing practice or new innovation.'
          ),
          body('What will be done:'),
          bullet('Link activities and reports to Results Framework targets and indicators.'),
          bullet('Add performance status fields and mandatory narrative fields (reason; practice vs innovation).'),
          bullet('Build ambassador and HOD views showing target vs actual performance.'),

          sectionHeading('4. Automatic progress from milestones'),
          body(
            'Meaning: Progress should not rely on manual percentage entry. It should be calculated automatically from predefined milestones (e.g. Concept Note 10%, Detailed Proposal 20%, up to Approval 100%). The system should also report cumulative progress, pending tasks, and historical performance.'
          ),
          body('What will be done:'),
          bullet('Define milestone templates per activity type.'),
          bullet('Auto-calculate progress when milestones are completed.'),
          bullet('Replace or supplement manual progress fields.'),
          bullet('Add cumulative, pending, and historical performance reports.'),

          sectionHeading('5. Quantitative performance indicators'),
          body(
            'Meaning: The system should capture numerical indicators (e.g. number of concept notes, student registrations by programme and faculty). This data should automatically populate unit dashboards and aggregated management reports.'
          ),
          body('What will be done:'),
          bullet('Add quantitative indicator fields linked to activities and results.'),
          bullet('Support programme/faculty disaggregation where required (e.g. Registrar’s office).'),
          bullet('Feed indicators into unit dashboards and management-level reports.'),

          sectionHeading('6. HR system boundaries'),
          body(
            'Meaning: The M&E system must not duplicate HRMS functions. Only the HR Ambassador should have full staff profile access. Unit Heads and Ambassadors should see only workload-related information (name, designation, assigned tasks, progress) without sensitive personal or HR records.'
          ),
          body('What will be done:'),
          bullet('Restrict ambassador and HOD staff views to non-sensitive fields only.'),
          bullet('Retain full profiles for HR Ambassador role only.'),
          bullet('Align visibility rules with HR API sync boundaries.'),

          sectionHeading('Overall direction'),
          body(
            'In summary, the planned work covers: (1) security through unit data isolation; (2) a simpler ambassador UX focused on Reporting and Tracking; (3) Results Framework–aligned reporting; (4) milestone-based automatic progress; (5) quantitative indicators on dashboards and reports; and (6) limited HR data exposure for ambassadors and HODs.'
          ),
        ],
      },
    ],
  });

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, OUT_FILE);
  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
  console.log(`Wrote: ${outPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
