/**
 * One-off generator for a progress-update response DOCX (external sharing).
 * Run: node scripts/generate-progress-update-docx.js
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

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22 })],
  });
}

async function run() {
  const outDir = 'D:\\letters report doc';
  const outPath = path.join(outDir, 'M_E_Portal_Progress_Update_Response_2026-06-01.docx');

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'M&E Portal – Progress Update (Response)',
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: 'Status of reports/tabs and outstanding items (as at 01 June 2026)',
                size: 24,
              }),
            ],
          }),

          heading('1. Summary of concerns raised', HeadingLevel.HEADING_2),
          body(
            'The team is pleased with progress and expects data entry to start soon. The key concerns relate to: (i) strategic plan ambassadors and their permissions/workflow, (ii) HR portal integration for staff development/qualifications/teaching load, (iii) previous appraisal results visibility, (iv) staff establishment additional breakdowns and percentages, (v) staff-to-student ratio meaning and data sources, (vi) programme enrolment data ownership, (vii) completeness of staff payments fields, (viii) department-scoped access and one-item entry UX, and (ix) broken virtual assistant and logo.'
          ),

          heading('2. What is done', HeadingLevel.HEADING_2),
          bullet('Reports tabs/tables added for Strategic Priority, Job Descriptions & Workplans, Staff–Student Ratio (teaching staff listing), Programme Enrollment, and Course Unit Enrollment.'),
          bullet('All newly added report tabs support exports (PDF/Excel) following existing report patterns.'),
          bullet('Database schema prepared as one SQL bundle that can be run once on the hosted server (CREATE TABLE statements).'),
          bullet('Reports page UI improved: removed the global full-width filter card; filters now live within the Activity Progress Summary table header.'),
          bullet('Build issues resolved so the project compiles with the new tabs/tables.'),

          heading('3. What is not done / pending (action required)', HeadingLevel.HEADING_2),
          bullet('Ambassador role/workflow: no dedicated “strategic plan ambassador” role UI to capture missing data; no department-scoped permissions yet.'),
          bullet('HR portal integration: Staff Development data is not yet pulled automatically from HR; qualifications and teaching load are not yet integrated from HR.'),
          bullet('Previous appraisal integration: historical appraisal/evaluation results are not yet displayed inside the M&E portal.'),
          bullet('Staff Establishment additions: missing breakdowns for active/retired/resigned/etc., and missing % views per FY (e.g., % recruited by unit/FY).'),
          bullet('Staff-to-student ratio: current section does not yet show student vs staff numbers per programme; it currently lists teaching staff. Needs redesign per the requested definition and HR-fed qualification fields.'),
          bullet('Programme enrolment ownership: need confirmation whether data will be provided by Dr Hudah’s team or integrated from HR; current implementation assumes manual entry into created tables until integration is done.'),
          bullet('Payments completeness: needs reconciliation with the data collection tool to ensure all fields (wages, pension, gratuity, etc.) are fully reflected.'),
          bullet('Data entry UX: “one item at a time” entry form for ambassadors and admin-only aggregated visibility are not yet implemented.'),
          bullet('Virtual assistant and MUBS logo issues have not yet been investigated/fixed.'),

          heading('4. Next steps (recommended)', HeadingLevel.HEADING_2),
          bullet('Confirm list of nominated strategic plan ambassadors and onboard them with department-scoped access.'),
          bullet('Implement ambassador data entry screens (single item submission + audit trail) and admin-only aggregated reporting.'),
          bullet('Integrate HR portal endpoints/forms for Staff Development, Qualifications, Teaching Load, and Student Enrollment where required.'),
          bullet('Align Staff Establishment section with the provided data collection tool/document (statuses + % by FY/unit).'),
          bullet('Redesign Staff-to-student ratio to programme-level students vs staff counts (and pull qualification details from HR).'),
          bullet('Fix broken virtual assistant and logo rendering.'),

          body('Best wishes,', { bold: true }),
          body('Spanner', {}),
        ],
      },
    ],
  });

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote: ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

