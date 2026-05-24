/**
 * Generator for public/HR-ME_Implementation_Backlog.docx
 * Run: node scripts/generate-hr-me-backlog-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} = require('docx');

const BASE_URL = 'https://mubsme.mubs.ac.ug';
const DATE = 'May 2026';

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function sectionBlock(title, items, partialNote) {
  const children = [heading(title, HeadingLevel.HEADING_3)];
  if (partialNote) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: partialNote, italics: true, size: 20, color: '555555' }),
        ],
      })
    );
  }
  for (const item of items) {
    children.push(bullet(item));
  }
  return children;
}

function phaseTable(phases) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: phases.map(([phase, focus], i) =>
      new TableRow({
        children: [phase, focus].map((text) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: i === 0, size: 20 })],
              }),
            ],
          })
        ),
      })
    ),
  });
}

const sections = [
  {
    title: '1. HR ↔ M&E integration',
    items: [
      'Connect to the HR system (API, database sync, or scheduled ETL — approach TBD)',
      'Automatic extraction and transfer of HR data into M&E indicator fields',
      'Real-time or scheduled updates when HR records change',
      'Map HR fields to Strategic Plan Results Framework indicators (HR-related)',
      'Reduce manual data collection for HR-based indicators',
      'Historical HR data import for trend analysis',
    ],
  },
  {
    title: '2. Staff biodata — personal and employment',
    partial: 'Partial today: name parts, employee ID, staff category, position, contract dates, department.',
    items: [
      'Gender',
      'Nationality',
      'Date of birth',
      'Employment category (align with HR grades beyond Academic/Administrative/Support)',
      'Designation (full alignment with HR grading)',
      'Date of first appointment',
      'Date appointed to current position',
      'Calculated: years in current position',
      'Calculated: years in current office',
      'Contract status (full HR lifecycle, not only contract type/terms)',
      'Retirement date and “nearing retirement” reporting',
    ],
  },
  {
    title: '3. Staff biodata — persons with disabilities (PwD)',
    items: [
      'Disability status',
      'Type/category of disability',
      'Workplace accommodation requirements',
      'Special support needs',
      'Reports disaggregated by: designation/grade, department/office, staff category, gender',
    ],
  },
  {
    title: '4. Staff development and training',
    items: [
      'Programme title/name',
      'Training level: short-term, certification, postgraduate diploma, Master’s, PhD, postdoctoral',
      'Area of specialisation',
      'Institution and country of study',
      'Mode of study and sponsorship category',
      'Start date, expected completion date, planned duration',
      'Calculated: remaining study period',
      'Status: Planned / Yet to start / Ongoing / Suspended / Completed',
      'Training reports and linkage to M&E indicators',
    ],
  },
  {
    title: '5. Integration with staff appraisal',
    partial: 'Note: Current “Staff Appraisal” tab is task-completion reporting, not HR appraisal.',
    items: [
      'Prompt staff to update biodata before appraisal submission',
      'Flag incomplete mandatory fields',
      'Audit trail and update history for profile changes',
      'Reminders for pending profile updates',
      'Supervisor verification workflow for biodata updates',
      'Align appraisal cycle with M&E reporting periods',
    ],
  },
  {
    title: '6. HR employment status (real-time)',
    partial: 'Partial today: employment_status may exist in DB; limited UI and no full lifecycle reports.',
    items: [
      'HR Unit UI to update employment status in real time',
      'Statuses: Active, Retired, Resigned, Terminated, Dismissed, Deceased',
      'Leave types: Study leave, Sabbatical leave',
      'Contract staff reporting',
      'Historical records preserved for reporting and trends',
      'Reports by employment status over time',
    ],
  },
  {
    title: '7. Academic staff module',
    items: [
      'Programme(s) taught',
      'Course unit(s) taught',
      'Teaching load and semester allocations',
      'Research supervision responsibilities',
      'Academic specialisation areas',
      'Reports for academic staffing indicators',
    ],
  },
  {
    title: '8. Workforce planning and establishment',
    items: [
      'Approved, filled, and vacant positions',
      'Staffing gaps and percentage establishment',
      'Staffing levels by grade and category',
      'Staff nearing retirement',
      'Future recruitment needs and succession planning',
      'Projections: retirements, study completions, turnover, planned growth',
    ],
  },
  {
    title: '9. Disaggregated reporting',
    items: [
      'Gender (Male/Female) on all relevant HR/M&E reports',
      'Persons with disabilities disaggregation on all relevant reports',
      'Consistent breakdowns at department, faculty, and institution level',
    ],
  },
  {
    title: '10. Reporting exports and dashboards (gaps)',
    partial: 'Partial today: PDF, Excel, and charts for M&E activity performance only.',
    items: [
      'Word (.docx) export from the system',
      'HR-specific dashboards (not only task/activity performance)',
      'Automated Results Framework reports fed from HR data',
      'Trend and historical analysis views for HR indicators',
    ],
  },
  {
    title: '11. Cross-cutting / technical',
    items: [
      'Data model for biodata, training, PwD, academic load, establishment',
      'Role permissions: HR Unit, staff self-service, supervisor, admin',
      'Validation rules and configurable mandatory fields',
      'Extend notifications/reminders for HR data updates',
      'Approval workflows (extend submission review pattern)',
      'Migration from legacy narrative biodata + attachments to structured fields',
      'Documentation and training for HR and M&E units',
    ],
  },
];

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: 'HR–M&E Integration: Implementation Backlog',
        bold: true,
        size: 32,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({
        text: 'MUBS Strategic Plan Results Framework',
        size: 26,
      }),
    ],
  }),
  body(`Related system: ${BASE_URL}`),
  body(`Status document: ${DATE}`),
  body(
    'This backlog lists work not yet delivered against the HR–M&E integration request. Items marked “partial” have limited support in the current M&E deployment.'
  ),
  heading('Suggested implementation phases', HeadingLevel.HEADING_2),
  phaseTable([
    ['Phase', 'Focus'],
    ['Phase 1', 'Structured biodata + employment status + HR admin UI'],
    ['Phase 2', 'PwD module + gender/disability reports'],
    ['Phase 3', 'Training module + study-leave linkage'],
    ['Phase 4', 'Appraisal integration + supervisor verification'],
    ['Phase 5', 'Academic staff + workforce establishment'],
    ['Phase 6', 'HR↔M&E sync + Results Framework auto-indicators'],
  ]),
  new Paragraph({ spacing: { after: 200 } }),
  heading('Detailed backlog', HeadingLevel.HEADING_2),
];

for (const sec of sections) {
  children.push(...sectionBlock(sec.title, sec.items, sec.partial));
}

children.push(
  heading('Related documents', HeadingLevel.HEADING_2),
  bullet(`${BASE_URL}/Response_HR-ME_Integration_MUBS.docx — status of what is done vs not done`),
  bullet(`${BASE_URL}/system_report.txt — current M&E feature summary (if served)`),
  new Paragraph({
    spacing: { before: 300 },
    children: [
      new TextRun({
        text: 'Use this document for planning, prioritisation, and assignment of owners. Update as items are completed.',
        italics: true,
        size: 20,
        color: '666666',
      }),
    ],
  })
);

const doc = new Document({
  sections: [{ properties: {}, children }],
});

const outPath = path.join(__dirname, '..', 'public', 'HR-ME_Implementation_Backlog.docx');

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outPath, buffer);
    console.log('Created:', outPath);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
