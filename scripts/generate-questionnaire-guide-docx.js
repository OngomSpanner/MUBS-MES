/**
 * User guide: Questionnaire module + Ambassador data collection.
 * Run: node scripts/generate-questionnaire-guide-docx.js
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
const OUT_FILE = 'M_E_Questionnaire_and_Ambassador_Data_Collection_Guide.docx';

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

function tableCell(text, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 18 })],
      }),
    ],
  });
}

async function run() {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const exampleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell('Metric', true),
          tableCell('2025/26', true),
          tableCell('2026/27', true),
        ],
      }),
      new TableRow({
        children: [
          tableCell('No. of programmes/courses developed within approved timelines'),
          tableCell('(ambassador enters number)'),
          tableCell('(ambassador enters number)'),
        ],
      }),
      new TableRow({
        children: [
          tableCell('% of programmes/courses reviewed within approved timelines'),
          tableCell('(ambassador enters %)'),
          tableCell('(ambassador enters %)'),
        ],
      }),
      new TableRow({
        children: [
          tableCell('No. of trainings on curriculum/course development and review (CBET)'),
          tableCell('(ambassador enters number)'),
          tableCell('(ambassador enters number)'),
        ],
      }),
    ],
  });

  const mappingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell('Word document field', true),
          tableCell('In M&E system', true),
          tableCell('Unit of measure', true),
        ],
      }),
      new TableRow({
        children: [
          tableCell('No. of programmes/courses developed within approved timelines'),
          tableCell('Metric 1'),
          tableCell('Numeric'),
        ],
      }),
      new TableRow({
        children: [
          tableCell('% of programmes/courses reviewed within approved timelines'),
          tableCell('Metric 2'),
          tableCell('Percentage'),
        ],
      }),
      new TableRow({
        children: [
          tableCell('No. of trainings conducted (CBET)'),
          tableCell('Metric 3'),
          tableCell('Numeric'),
        ],
      }),
    ],
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
            children: [new TextRun({ text: 'MUBS M&E System', bold: true, size: 32 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: 'Questionnaire & Ambassador Data Collection — User Guide',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Based on: Revised Questions for Data Collection  |  ${dateStr}`,
                italics: true,
                size: 18,
              }),
            ],
          }),

          title('What is this for?'),
          body(
            'The Questionnaire module is used to collect performance data from offices and departments across MUBS. An administrator builds the empty form (questions, years, and who must fill it). Ambassadors enter the real numbers for their unit. The system then shows those numbers in the indicator template and in Reports.'
          ),
          body(
            'Think of it like a shared spreadsheet: Admin designs the form → Ambassadors fill in their office’s figures → Admin and Reports display the results.'
          ),

          title('What is in the Word document?'),
          body(
            'The Revised Questions for Data Collection document uses standards such as Curriculum/Course Development and Review (Standard MUBS/P1/OBJ12/REG/S007). Each standard has:'
          ),
          bullet('Output / Service Description — what service is being delivered'),
          bullet('Performance Indicators — what you count or measure'),
          bullet('Other columns (Quality, Process, Target beneficiary, Methodology, Inputs, etc.) — background description of the standard'),
          body(
            'Important: The long descriptive columns in the Word table are reference information. Ambassadors fill only the metric values (numbers, percentages, or text) per financial year in the M&E system.'
          ),

          heading('Part 1 — Admin: Set up the questionnaire (build the empty form)'),
          body('Where: Admin portal → Questionnaire'),

          subheading('Step 1: Create an Outcome or Output (group)'),
          numbered(1, 'Open the Manage Outcomes tab.'),
          numbered(2, 'Add a group, e.g. Output → “Curriculum/Course Development and Review”.'),
          body('This groups related indicators, like a section in the Word document.'),

          subheading('Step 2: Create an Indicator'),
          numbered(1, 'Go to the Indicators tab → Create Indicator.'),
          numbered(2, 'Indicator text: e.g. “Curriculum/Course developed and reviewed” (matches Output Service Description).'),
          numbered(3, 'Select the Outcome/Output group from Step 1.'),

          subheading('Step 3: Add Metrics (rows in the grid)'),
          body('Each bullet under Performance Indicator in the Word document becomes one metric row:'),
          mappingTable,
          new Paragraph({ spacing: { after: 80 }, children: [] }),

          subheading('Step 4: Choose Financial Years (columns)'),
          body('Select the years you want data for (e.g. 2025/26, 2026/27). Each metric gets a cell for each year.'),

          subheading('Step 5: Assign Departments'),
          body(
            'Select which offices must report (e.g. faculties, School Registrar, QAD). Only assigned departments see that indicator. Each department should have an Ambassador user linked to that unit.'
          ),

          subheading('Step 6: Save'),
          body('You now have an empty template — structure only, no numbers yet.'),
          body('Optional: Lock the indicator when collection is complete so ambassadors cannot edit it.'),

          heading('Part 2 — Ambassador: Fill in the data'),
          body('Who: A user with the Ambassador role, linked to one managed unit (office/department).'),
          body('Where: Ambassador portal → Data Collection'),

          subheading('What the ambassador sees'),
          bullet('Only indicators assigned to their department'),
          bullet('Status: Not started / In progress / Complete'),

          subheading('How to fill'),
          numbered(1, 'Click an indicator (e.g. Curriculum/Course developed and reviewed).'),
          numbered(2, 'A grid opens with metrics as rows and financial years as columns:'),
          exampleTable,
          new Paragraph({ spacing: { after: 80 }, children: [] }),
          numbered(3, 'Enter values. The system checks format (numbers, percentages, etc.).'),
          numbered(4, 'Click Save.'),
          body(
            'Data is stored per department. Faculty A and Faculty B each enter their own figures separately.'
          ),

          heading('Part 3 — Where filled data appears'),
          bullet('Admin → Questionnaire → Indicators: expand the indicator to see all departments’ submitted values.'),
          bullet('Admin → Reports → Data Collection → Ambassador: same data in a report table with filters.'),

          heading('End-to-end flow'),
          body('Word document (what to measure)'),
          body('↓ Admin builds template in Questionnaire (Outcome, Indicator, Metrics, FYs, Departments)'),
          body('↓ Ambassador fills numbers for their office'),
          body('↓ Values saved in the system (q_responses table)'),
          body('↓ Admin Questionnaire and Reports show the populated template'),

          heading('Worked example from the Word document'),
          body('Admin creates:'),
          bullet('Output: Curriculum/Course Development and Review'),
          bullet('Indicator: Curriculum/Course developed and reviewed'),
          bullet('Metrics: 3 rows (developed count, % reviewed, trainings count)'),
          bullet('Years: e.g. 2025/26, 2026/27'),
          bullet('Departments: all faculties and units that must report'),
          body('Ambassador for Faculty of Computing enters, for example:'),
          bullet('2025/26 — developed: 4, reviewed: 85%, trainings: 2'),
          bullet('2026/27 — (their figures for that year)'),
          body(
            'Admin opens Questionnaire, expands that indicator, and sees Faculty of Computing’s numbers alongside every other assigned department.'
          ),

          heading('Tips for new users'),
          bullet('Questionnaire = setup. Data Collection (Ambassador) = filling in.'),
          bullet('One Word performance indicator with three bullets = one indicator with three metrics.'),
          bullet('Descriptive Word columns stay in the standard document unless you add them as separate text metrics.'),
          bullet('Each ambassador only sees their department’s forms.'),
          bullet('Admin must assign departments when creating the indicator, or ambassadors will see nothing.'),

          heading('System access'),
          body('Ambassador: /ambassador  |  Strategy Manager (Admin): /admin → Questionnaire'),
        ],
      },
    ],
  });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(OUT_DIR, OUT_FILE);
  fs.writeFileSync(outPath, buffer);
  console.log('Written:', outPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
