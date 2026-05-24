/**
 * One-off generator for public/Response_HR-ME_Integration_MUBS.docx
 * Run: node scripts/generate-hr-me-response-docx.js
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
  BorderStyle,
} = require('docx');

const BASE_URL = 'https://mubsme.mubs.ac.ug';

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
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

function tableRow(cells, header = false) {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  bold: header,
                  size: 20,
                }),
              ],
            }),
          ],
        })
    ),
  });
}

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
              text: 'Response: HR System Integration with M&E System',
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
              text: 'Strategic Plan Results Framework Reporting',
              size: 26,
            }),
          ],
        }),
        body(`System (deployed): ${BASE_URL}`),
        body('Application: MUBS Monitoring & Evaluation (M&E) System'),
        body('Date: May 2026'),
        heading('1. Purpose', HeadingLevel.HEADING_2),
        body(
          'This document summarises what the deployed M&E system currently supports in relation to the request to improve reporting on the Strategic Plan Results Framework through HR–M&E integration and structured staff biodata. It also states what is not yet implemented and where features can be demonstrated.'
        ),
        heading('2. Executive summary', HeadingLevel.HEADING_2),
        body('Implemented:', { bold: true }),
        body(
          'A working M&E platform for strategic-plan activity monitoring, departmental tasks, staff submissions and evidence, head-of-department review workflows, notifications and email reminders, and PDF/Excel performance reporting, with basic structured user and contract fields on staff accounts.'
        ),
        body('Not yet implemented:', { bold: true }),
        body(
          'Full HR system integration (automatic extraction of HR data into M&E indicators), a redesigned staff biodata module (personal details, disability, training, academic load), appraisal-driven profile updates, workforce establishment/planning reports, and gender/disability-disaggregated HR reports as described in the request letter.'
        ),
        heading('3. What has been done', HeadingLevel.HEADING_2),
        heading('3.1 M&E and Strategic Plan reporting', HeadingLevel.HEADING_3),
        bullet('Standards and activities with performance indicators, aligned to Strategic Plan 2025–2030 pillars.'),
        bullet('Activity tracking across departments.'),
        bullet('Reports & Monitoring: department activity summaries, staff task-completion evaluations, strategic performance trends.'),
        bullet('Ambassador role for faculty-wide oversight.'),
        heading('3.2 Workflow, approvals, and notifications', HeadingLevel.HEADING_3),
        bullet('Staff submit reports and evidence; department heads review (accept / return / not done).'),
        bullet('In-app notifications and email reminders for deadlines, assignments, and reviews.'),
        bullet('Audit notes on process task reassignments.'),
        heading('3.3 Limited staff / employment fields', HeadingLevel.HEADING_3),
        body('Administrators can maintain when creating or editing users:'),
        bullet('Name (first, surname, other names), employee ID'),
        bullet('Staff category (Academic / Administrative / Support)'),
        bullet('Position, contract start/end, contract terms and type'),
        bullet('Account status (Active / Pending / Suspended)'),
        body('Department heads can view staff profiles including position, category, contract dates, employment status, and leave status.'),
        heading('3.4 “Staff Appraisal” reporting', HeadingLevel.HEADING_3),
        body(
          'The Staff Appraisal report tab reflects task completion rates (assigned vs completed M&E activities/processes), not a full HR appraisal or mandatory biodata update cycle.'
        ),
        heading('3.5 Exports and dashboards', HeadingLevel.HEADING_3),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow(['Format', 'Available', 'Notes'], true),
            tableRow(['Excel', 'Yes', 'Admin and department-head reports']),
            tableRow(['PDF', 'Yes', 'Admin and department-head reports']),
            tableRow(['Visual dashboards', 'Yes', 'Charts in department and ambassador views']),
            tableRow(['Word', 'No', 'Not available in current system']),
          ],
        }),
        new Paragraph({ spacing: { after: 200 } }),
        heading('3.6 Staff alerts', HeadingLevel.HEADING_3),
        body(
          'Department heads see operational alerts (e.g. contract end approaching, leave-related) under Staff & Warnings, linked to evaluations and tasks.'
        ),
        heading('4. Request items not yet delivered', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow(['Request area', 'Status'], true),
            tableRow([
              'Automatic HR → M&E data extraction and real-time HR-based indicators',
              'Not implemented',
            ]),
            tableRow([
              'Structured biodata (gender, nationality, DOB, appointment history, retirement, etc.)',
              'Not implemented (beyond basic user/contract fields)',
            ]),
            tableRow(['Persons with disabilities module and disaggregated reports', 'Not implemented']),
            tableRow(['Staff development and training module', 'Not implemented']),
            tableRow([
              'Appraisal-driven biodata update (prompts, mandatory fields, supervisor verification, audit trail)',
              'Not implemented',
            ]),
            tableRow([
              'Full employment lifecycle (retired, resigned, study leave, sabbatical, etc.) with historical HR reporting',
              'Partial at data/display level only',
            ]),
            tableRow([
              'Academic teaching load (programmes, course units, supervision, etc.)',
              'Not implemented',
            ]),
            tableRow(['Workforce planning / establishment analysis and projections', 'Not implemented']),
            tableRow(['Gender and disability disaggregation for HR reports', 'Not implemented']),
            tableRow(['Word export from system', 'Not implemented']),
          ],
        }),
        new Paragraph({ spacing: { after: 200 } }),
        heading('5. Where to access and demonstrate', HeadingLevel.HEADING_2),
        body(`Base URL: ${BASE_URL}`),
        body('Log in with the appropriate role.'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow(['Role', 'URL', 'Demonstration focus'], true),
            tableRow(['Admin', `${BASE_URL}/admin`, 'Strategic setup, tracking, users, reports']),
            tableRow([
              'Admin – strategic',
              `${BASE_URL}/admin?pg=strategic`,
              'Standards, indicators, activities',
            ]),
            tableRow([
              'Admin – tracking',
              `${BASE_URL}/admin?pg=tracking`,
              'Institution-wide activity monitoring',
            ]),
            tableRow([
              'Admin – users',
              `${BASE_URL}/admin?pg=users`,
              'Staff accounts and contract fields',
            ]),
            tableRow([
              'Admin – reports',
              `${BASE_URL}/admin?pg=reports`,
              'Summaries, staff evaluation tab, exports',
            ]),
            tableRow(['Department Head', `${BASE_URL}/department-head`, 'Department operations']),
            tableRow([
              'HOD – staff',
              `${BASE_URL}/department-head?pg=staff`,
              'Staff profiles and alerts',
            ]),
            tableRow([
              'HOD – reviews',
              `${BASE_URL}/department-head?pg=evaluations`,
              'Submission review workflow',
            ]),
            tableRow([
              'HOD – reports',
              `${BASE_URL}/department-head?pg=reports`,
              'Performance reports and charts',
            ]),
            tableRow(['Staff', `${BASE_URL}/staff`, 'Tasks, submissions, notifications']),
            tableRow(['Ambassador', `${BASE_URL}/ambassador`, 'Faculty-wide dashboard and reports']),
          ],
        }),
        new Paragraph({ spacing: { after: 120 } }),
        body(`Optional public summary (if served): ${BASE_URL}/system_report.txt`),
        heading('6. Conclusion', HeadingLevel.HEADING_2),
        body(
          `The deployed system at ${BASE_URL} provides a solid M&E and strategic-plan execution environment. The HR integration and expanded HR reporting described in the request letter remain future work and should be planned as a separate phase (biodata schema, training module, HR sync, workforce analytics, and appraisal-linked updates).`
        ),
        new Paragraph({
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: 'Prepared for institutional reporting. Adjust date and signatory as required.',
              italics: true,
              size: 20,
              color: '666666',
            }),
          ],
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, '..', 'public', 'Response_HR-ME_Integration_MUBS.docx');

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outPath, buffer);
    console.log('Created:', outPath);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
