/**
 * One-page response to action points 2.1–2.5.
 * Run: node scripts/generate-action-points-response-docx.js
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
  Table,
  TableRow,
  TableCell,
  WidthType,
  ExternalHyperlink,
} = require('docx');

const BASE = 'https://mubsme.mubs.ac.ug';
const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_Portal_Action_Points_Completed_Response.docx';

function row(item, done, demo) {
  return new TableRow({
    children: [item, done, demo].map(
      (text) =>
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, size: 18 })] })],
        })
    ),
  });
}

async function run() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: 'M&E Portal — Action Points Completed', bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: BASE, size: 20 }),
              new TextRun({
                text: `  ·  ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                size: 20,
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ['Item', 'Done', 'How to view'].map((t) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: t, bold: true, size: 18 })],
                      }),
                    ],
                  })
                ),
              }),
              row(
                '2.1 Staff Establishment',
                'Employment status filter (active, retired, resigned, etc.); headcount by designation across two financial years (M/F/PwD).',
                `${BASE}/admin?pg=reports → Staff Establishment tab → Employment status dropdown.`
              ),
              row(
                '2.2 Staff–Student Ratio',
                'Report shows students vs teaching staff per programme with ratio (1:N).',
                `${BASE}/admin?pg=reports → Staff-Student Ratio tab.`
              ),
              row(
                '2.3 Ambassador Portal',
                'Single-item Add entry; Benefits, Workforce & Skills assessments, Recruitment; unit staff list; ambassadors assigned per department on Users.',
                `${BASE}/ambassador?pg=reports (data entry) · ${BASE}/admin?pg=users (assign Ambassador + oversight unit).`
              ),
              row(
                '2.4 HR integration',
                'HR Sync on Users; Staff Development report (AY, teaching/non-teaching); qualifications in staff profiles from HR sync.',
                `${BASE}/admin?pg=users (HR Sync) · ${BASE}/admin?pg=reports → Staff Development / Staff Appraisal.`
              ),
              row(
                '2.5 Logo & chat',
                'Logo fixed (WebP); Tawk.to live chat on all pages; sidebar help links mubsme@mubs.ac.ug.',
                `${BASE} (login logo) · chat bubble bottom-right after sign-in.`
              ),
            ],
          }),
          new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [
              new TextRun({
                text: 'Note: ',
                bold: true,
                size: 18,
              }),
              new TextRun({
                text: 'Run sql/deploy_migrations_bundle.sql on the server if not already applied, then restart the app.',
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Contact: ', size: 18 }),
              new ExternalHyperlink({
                link: 'mailto:mubsme@mubs.ac.ug',
                children: [new TextRun({ text: 'mubsme@mubs.ac.ug', size: 18, style: 'Hyperlink', color: '0563C1' })],
              }),
            ],
          }),
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
