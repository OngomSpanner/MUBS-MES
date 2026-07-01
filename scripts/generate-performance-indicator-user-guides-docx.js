/**
 * User guides: Ambassador data entry + HOD review for performance indicators.
 * Run: node scripts/generate-performance-indicator-user-guides-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} = require('docx');

const OUT_DIR = 'D:\\letters report doc';
const APP_URL = 'https://mubsme.mubs.ac.ug';
const HOD_LABEL = 'Head of Department / Unit Head';

function title(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function heading(text) {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function subheading(text) {
  return new Paragraph({
    spacing: { before: 100, after: 40 },
    children: [new TextRun({ text, bold: true, size: 20 })],
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

function numbered(n, text) {
  return new Paragraph({
    spacing: { after: 50 },
    indent: { left: 360 },
    children: [new TextRun({ text: `${n}. ${text}`, size: 20 })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function screenshotPlaceholder(caption) {
  const dashed = {
    style: BorderStyle.DASHED,
    size: 1,
    color: '999999',
  };
  return [
    new Paragraph({
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({ text: caption, italics: true, size: 18, color: '666666' }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: dashed,
                bottom: dashed,
                left: dashed,
                right: dashed,
              },
              children: [
                new Paragraph({ spacing: { before: 500, after: 0 }, children: [] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: '[ Insert screenshot here ]',
                      italics: true,
                      size: 18,
                      color: 'AAAAAA',
                    }),
                  ],
                }),
                new Paragraph({ spacing: { before: 500, after: 80 }, children: [] }),
              ],
            }),
          ],
        }),
      ],
    }),
    spacer(),
  ];
}

function coverBlock(mainTitle, subtitle) {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'MUBS Monitoring & Evaluation System', bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [new TextRun({ text: mainTitle, bold: true, size: 26 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({ text: subtitle, italics: true, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: dateStr, italics: true, size: 18 })],
    }),
  ];
}

function buildAmbassadorGuide() {
  return new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children: [
          ...coverBlock(
            'Strategic Plan Ambassador Guide',
            'How to enter performance indicator data',
          ),

          title('Who is this guide for?'),
          body(
            'This guide is for Strategic Plan Ambassadors who enter performance indicator figures for their assigned office or department in the MUBS M&E System.',
          ),
          body(
            'After you submit data, your Head of Department / Unit Head reviews it and either approves it or requests revision.',
          ),

          heading('Before you start'),
          bullet(`You need an active MUBS M&E account with the Ambassador role for your unit.`),
          bullet(`Your unit must already be assigned to the relevant performance indicators by the system administrator.`),
          bullet(`Use a desktop or laptop browser (Chrome, Edge, or Firefox recommended).`),

          heading('Step 1 — Log in to the M&E System'),
          numbered(1, `Open your browser and go to ${APP_URL}/`),
          numbered(2, 'Enter your MUBS email address and password, then click Sign in.'),
          numbered(3, 'Alternatively, use Sign in with Google if your account is linked to Google.'),
          numbered(4, 'If this is your first login, you may be asked to set a new password immediately.'),
          ...screenshotPlaceholder('Screenshot 1: Login page'),

          heading('Step 2 — Open the Ambassador portal'),
          numbered(1, 'After login, you should land in the Ambassador portal.'),
          numbered(2, 'If you have more than one role, open your profile menu (top right) and choose Switch Role → Strategic Plan Ambassador.'),
          numbered(3, 'Confirm the left sidebar shows Ambassador menu items such as Tracking and Reporting.'),
          ...screenshotPlaceholder('Screenshot 2: Ambassador portal home / sidebar'),

          heading('Step 3 — Go to Performance Indicators'),
          numbered(1, 'In the left sidebar, click Reporting.'),
          numbered(2, 'At the top of the Reporting page, open the Performance Indicators tab.'),
          numbered(3, `Direct link (after login): ${APP_URL}/ambassador?pg=reporting&tab=data-collection`),
          body('You will see summary cards and filter buttons for your assigned indicators.'),
          ...screenshotPlaceholder('Screenshot 3: Reporting → Performance Indicators list'),

          heading('Step 4 — Understand the page'),
          subheading('Summary cards'),
          bullet('Total indicators — all indicators assigned to your unit'),
          bullet('Not completed — draft or partially filled, not yet submitted'),
          bullet('Awaiting review — submitted and waiting for HOD review'),
          bullet('Completed — approved by your HOD'),
          bullet('Needs revision — returned by your HOD for correction'),

          subheading('Filter buttons'),
          bullet('Use All, Not completed, Awaiting review, Completed, or Needs revision to narrow the list.'),

          subheading('Each indicator card shows'),
          bullet('Indicator title and financial years (e.g. 2025/26)'),
          bullet('Number of metrics and how many cells are filled'),
          bullet('Progress status: Not started, In progress, or Complete'),
          bullet('HOD review status once submitted'),

          heading('Step 5 — Open an indicator and enter data'),
          numbered(1, 'Find the indicator you need to complete.'),
          numbered(2, 'Click Enter Data (or Update if you already started).'),
          numbered(3, 'A data entry window opens showing a table:'),
          bullet('Rows = performance metrics'),
          bullet('Columns = financial years'),
          bullet('Each cell = the value for that metric and year'),
          ...screenshotPlaceholder('Screenshot 4: Data entry table (metrics and financial years)'),

          heading('Step 6 — Fill in all required values'),
          numbered(1, 'Type the correct figure in each cell.'),
          numbered(2, 'Follow the unit of measure shown for each metric (number, percentage, text, etc.).'),
          numbered(3, 'Fix any validation messages shown in red before saving.'),
          numbered(4, 'The indicator must show Complete (all cells filled) before you can submit for review.'),
          ...screenshotPlaceholder('Screenshot 5: Completed data entry with all cells filled'),

          heading('Step 7 — Save your work'),
          subheading('Option A: Save draft'),
          body('Click Save draft to store your progress without sending to your HOD. You can return later and continue editing.'),
          ...screenshotPlaceholder('Screenshot 6: Save draft button'),

          subheading('Option B: Submit for HOD review'),
          numbered(1, 'When every cell is complete, click Submit for Head of Department / Unit Head review.'),
          numbered(2, 'The system saves your data and sends it for review.'),
          numbered(3, 'You and your HOD receive an in-app notification (and email if configured).'),
          numbered(4, 'After submission, the indicator becomes view-only until your HOD approves or requests revision.'),
          ...screenshotPlaceholder('Screenshot 7: Submit for HOD review button and success message'),

          heading('Step 8 — Track status after submission'),
          numbered(1, 'Use the Awaiting review filter to see submitted indicators.'),
          numbered(2, 'Status badge will show Awaiting review.'),
          numbered(3, 'Open the indicator with View to read the submitted figures (editing is locked).'),
          ...screenshotPlaceholder('Screenshot 8: Indicator awaiting HOD review'),

          heading('Step 9 — If revision is requested'),
          numbered(1, 'Open Notifications (sidebar or bell icon) or filter by Needs revision.'),
          numbered(2, 'Open the indicator — you will see the HOD feedback message.'),
          numbered(3, 'Click Update, correct the figures, and submit again for review.'),
          ...screenshotPlaceholder('Screenshot 9: Revision requested with HOD feedback'),

          heading('Step 10 — When approved'),
          body('Once your HOD approves the submission, status changes to Approved. The data is locked for editing and counts in management reports.'),
          ...screenshotPlaceholder('Screenshot 10: Approved indicator (view only)'),

          heading('Tips and reminders'),
          bullet('Save draft often while entering large indicators.'),
          bullet('Do not submit until all cells are complete — the Submit button stays disabled until then.'),
          bullet('If an indicator shows Locked, the administrator has closed editing; contact your M&E coordinator.'),
          bullet('You only see indicators assigned to your unit — not other departments.'),
          bullet('If no indicators appear, ask the Strategy & Projects team to confirm your unit assignment.'),

          heading('Quick reference'),
          body(`Login: ${APP_URL}/`),
          body(`Performance Indicators: Reporting → Performance Indicators`),
          body('Save draft = work in progress'),
          body(`Submit for ${HOD_LABEL} review = send to HOD for approval`),
          body('Needs revision = update figures and resubmit'),
        ],
      },
    ],
  });
}

function buildHodGuide() {
  return new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children: [
          ...coverBlock(
            'Head of Department / Unit Head Guide',
            'How to review, approve, or request revision of performance indicator data',
          ),

          title('Who is this guide for?'),
          body(
            `This guide is for Heads of Department / Unit Heads who review performance indicator submissions entered by Strategic Plan Ambassadors in their department or unit.`,
          ),

          heading('Before you start'),
          bullet('You need an active MUBS M&E account with the HOD / Unit Head role.'),
          bullet('Ambassadors in your unit submit indicator data for your review.'),
          bullet('You can approve correct submissions or request revision with written feedback.'),

          heading('Step 1 — Log in to the M&E System'),
          numbered(1, `Open your browser and go to ${APP_URL}/`),
          numbered(2, 'Enter your MUBS email address and password, then click Sign in.'),
          numbered(3, 'Alternatively, use Sign in with Google if enabled for your account.'),
          numbered(4, 'If this is your first login, set a new password when prompted.'),
          ...screenshotPlaceholder('Screenshot 1: Login page'),

          heading('Step 2 — Open the HOD portal'),
          numbered(1, 'After login, you should land in the Department Head portal.'),
          numbered(2, 'If you have more than one role, open your profile menu (top right) → Switch Role → Head of Department (HOD) / Unit Head.'),
          numbered(3, 'Confirm the sidebar shows items such as Dashboard and Submissions & reviews.'),
          ...screenshotPlaceholder('Screenshot 2: HOD portal / sidebar'),

          heading('Step 3 — Go to Performance indicators'),
          numbered(1, 'In the left sidebar, click Submissions & reviews.'),
          numbered(2, 'Open the Performance indicators tab at the top of the page.'),
          numbered(3, `Direct link (after login): ${APP_URL}/department-head?pg=evaluations&tab=questionnaire`),
          body('You can also open a submission from the Notifications page or bell icon when an ambassador submits data.'),
          ...screenshotPlaceholder('Screenshot 3: Submissions & reviews → Performance indicators'),

          heading('Step 4 — Understand the submissions list'),
          body('The table shows one row per indicator submission for departments you oversee.'),
          bullet('Indicator — title of the performance indicator'),
          bullet('Outcome / output — the strategic grouping'),
          bullet('Department — the unit that submitted'),
          bullet('Submitted — date and time of last submission'),
          bullet('Status — Not submitted, Awaiting review, Approved, or Revision requested'),
          bullet('Actions — Review or View'),

          subheading('Filter buttons'),
          bullet('All — every assigned indicator'),
          bullet('Not completed — not yet submitted by ambassador'),
          bullet('Awaiting review — ready for your action'),
          bullet('Completed — you have approved'),
          bullet('Needs revision — you returned for correction'),
          ...screenshotPlaceholder('Screenshot 4: Submissions list with filters'),

          heading('Step 5 — Open a submission for review'),
          numbered(1, 'Click the Awaiting review filter to see pending items.'),
          numbered(2, 'Find the row with status Awaiting review.'),
          numbered(3, 'Click the Review button in the Actions column.'),
          numbered(4, 'A review window opens showing the submitted data table (metrics × financial years).'),
          ...screenshotPlaceholder('Screenshot 5: Review performance indicator window'),

          heading('Step 6 — Check the submitted figures'),
          numbered(1, 'Read each metric row and confirm values for every financial year.'),
          numbered(2, 'Check units of measure (number, percentage, text, etc.).'),
          numbered(3, 'Note who submitted and when (shown under the indicator title).'),
          numbered(4, 'Compare against your records or source documents if needed.'),
          ...screenshotPlaceholder('Screenshot 6: Submitted data table close-up'),

          heading('Step 7 — Approve the submission'),
          numbered(1, 'If the data is correct, optionally type a short comment in the Feedback box.'),
          numbered(2, 'Click Approve.'),
          numbered(3, 'Status changes to Approved. The ambassador is notified.'),
          numbered(4, 'Approved data is locked and included in official M&E reports.'),
          ...screenshotPlaceholder('Screenshot 7: Approve action'),

          heading('Step 8 — Request revision (return for correction)'),
          numbered(1, 'If figures are wrong or incomplete, type clear feedback in the Feedback box.'),
          numbered(2, 'Feedback is required when requesting revision.'),
          numbered(3, 'Click Request revision.'),
          numbered(4, 'Status changes to Revision requested. The ambassador can edit and resubmit.'),
          body('Be specific in your feedback — name the metric, year, and what should change.'),
          ...screenshotPlaceholder('Screenshot 8: Request revision with feedback'),

          heading('Step 9 — After the ambassador resubmits'),
          numbered(1, 'You receive another notification when the ambassador resubmits.'),
          numbered(2, 'The row returns to Awaiting review.'),
          numbered(3, 'Click Review again and repeat approve or request revision as needed.'),
          ...screenshotPlaceholder('Screenshot 9: Resubmitted item awaiting review'),

          heading('Step 10 — View completed submissions'),
          numbered(1, 'Use the Completed filter for approved items.'),
          numbered(2, 'Click View to open read-only copies of past submissions.'),
          numbered(3, 'Use this to audit figures without changing them.'),
          ...screenshotPlaceholder('Screenshot 10: Approved submission (view only)'),

          heading('Using notifications'),
          numbered(1, 'When an ambassador submits, a notification appears in the bell icon (sidebar and top bar).'),
          numbered(2, 'Open Notifications and click View on the alert.'),
          numbered(3, 'You are taken to the relevant review area.'),
          ...screenshotPlaceholder('Screenshot 11: Notification for new performance indicator submission'),

          heading('Tips and reminders'),
          bullet('Review submissions promptly so ambassadors can correct errors before reporting deadlines.'),
          bullet('Always give clear feedback when requesting revision.'),
          bullet('Approval is final for that submission cycle — ambassadors cannot edit approved data.'),
          bullet('If no submissions appear, confirm ambassadors have been assigned to your unit and indicators exist.'),
          bullet('Contact the Strategy & Projects / M&E team for access or assignment issues.'),

          heading('Quick reference'),
          body(`Login: ${APP_URL}/`),
          body('Review area: Submissions & reviews → Performance indicators'),
          body('Awaiting review = action required (click Review)'),
          body('Approve = accept figures'),
          body('Request revision = return to ambassador with mandatory feedback'),
        ],
      },
    ],
  });
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const ambassadorFile = 'M_E_Ambassador_Performance_Indicators_Guide.docx';
  const hodFile = 'M_E_HOD_Performance_Indicators_Review_Guide.docx';

  const ambassadorBuffer = await Packer.toBuffer(buildAmbassadorGuide());
  const hodBuffer = await Packer.toBuffer(buildHodGuide());

  const ambassadorPath = path.join(OUT_DIR, ambassadorFile);
  const hodPath = path.join(OUT_DIR, hodFile);

  fs.writeFileSync(ambassadorPath, ambassadorBuffer);
  fs.writeFileSync(hodPath, hodBuffer);

  console.log('Written:', ambassadorPath);
  console.log('Written:', hodPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
