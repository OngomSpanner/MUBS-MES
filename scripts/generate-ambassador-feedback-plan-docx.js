/**
 * Implementation plan: ambassador feedback — what will be changed/updated.
 * Run: node scripts/generate-ambassador-feedback-plan-docx.js
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
} = require('docx');

const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_System_Ambassador_Feedback_Implementation_Plan.docx';
const BASE = 'https://mubsme.mubs.ac.ug';

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 100 },
    children: [new TextRun({ text, size: 22, bold: !!opts.bold, italics: !!opts.italics })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26 })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 70 },
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
  });
}

function planRow(area, change, modules) {
  return new TableRow({
    children: [area, change, modules].map(
      (text) =>
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, size: 18 })] })],
        })
    ),
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
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'MUBS M&E System',
                bold: true,
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'Ambassador Feedback — Implementation Plan',
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({ text: BASE, size: 20 }),
              new TextRun({ text: `  ·  ${dateStr}`, size: 20 }),
            ],
          }),

          sectionHeading('Purpose'),
          body(
            'This document translates Strategic Plan Ambassador feedback into a practical plan of system changes. It describes what will be updated in the M&E portal, the intended outcome of each change, and the main areas of the application affected.'
          ),

          sectionHeading('Implementation approach'),
          body('Work is grouped into four phases, starting with security and navigation, then reporting logic, then automation and indicators.'),
          bullet('Phase 1 — Security & access control (priority: high)'),
          bullet('Phase 2 — Ambassador UX simplification (priority: high)'),
          bullet('Phase 3 — Results Framework reporting (priority: medium–high)'),
          bullet('Phase 4 — Milestone progress & quantitative indicators (priority: medium)'),

          sectionHeading('Phase 1 — Strict unit data isolation'),
          subHeading('Problem'),
          body(
            'Ambassadors can currently see data outside their assigned unit (e.g. activities from HR when assigned to Strategy & Projects). Access must be limited to the assigned ambassador, HOD, Strategy & Projects Planner, and Principal only.'
          ),
          subHeading('What will be changed'),
          bullet('Enforce managed-unit scoping on all ambassador API routes (compliance/activity progress, staff lists, HR report tabs).'),
          bullet('Audit and tighten department-head routes so HODs only see their own department/unit tree.'),
          bullet('Review middleware and role routing to block cross-unit access by URL manipulation.'),
          bullet('Add server-side checks in lib/ambassador (context, managed-unit-departments, department-compliance) so queries always filter by managed_unit_id and child department IDs.'),
          subHeading('Affected areas'),
          bullet('API: app/api/ambassador/*, app/api/dashboard/ambassador'),
          bullet('Libraries: lib/ambassador/context.ts, lib/ambassador/managed-unit-departments.ts, lib/ambassador/department-compliance.ts'),
          bullet('UI: Ambassador dashboard, Dept./Unit Activity Progress, ambassador report panels'),

          sectionHeading('Phase 2 — Simplify ambassador navigation'),
          subHeading('Problem'),
          body(
            'The ambassador sidebar has too many top-level items (staff profiles, recruitment, benefits, assessments, enrollment, etc.). Users want a simpler structure focused on Reporting and Tracking, plus a place to propose structural or data changes.'
          ),
          subHeading('What will be changed'),
          bullet('Restructure ambassador sidebar (components/Sidebar.tsx) into two main groups: Tracking and Reporting.'),
          bullet('Group existing report tabs under Reporting (HR/M&E data entry sections).'),
          bullet('Place Dept./Unit Activity Progress and related monitoring under Tracking.'),
          bullet('Add a new “Propose changes” page or modal for ambassadors to submit requests (unit structure, indicators, activity templates) to System Administrator / Strategy Manager.'),
          bullet('Simplify ambassador dashboard quick actions to match the new menu structure.'),
          subHeading('Proposed menu structure'),
          bullet('Tracking: Dept./Unit Dashboard, Dept./Unit Activity Progress, Risk alerts (where applicable).'),
          bullet('Reporting: Staff Recruitment, Staff Benefits, Workforce Assessments, Skills Assessments, Programme/Course Enrollment (role-based), Staff Profiles (HR Ambassador only).'),
          bullet('Propose changes: New feedback/submission form with status tracking.'),

          sectionHeading('Phase 3 — Results Framework–aligned reporting'),
          subHeading('Problem'),
          body(
            'Reporting is activity-centric. Ambassadors and unit heads need reporting anchored to the Results Framework: targets, expected outcomes, actual performance, and classification as underperformance, achievement, or overachievement — with reasons and practice vs innovation notes.'
          ),
          subHeading('What will be changed'),
          bullet('Link strategic activities and reports to Results Framework targets/indicators (standards/objectives layer).'),
          bullet('Add performance status field: Underperformance | Achievement | Overachievement.'),
          bullet('Add mandatory narrative fields on submission/reporting: reason for outcome; existing practice vs new innovation.'),
          bullet('Build ambassador and HOD views showing target vs actual side by side.'),
          bullet('Update report exports (PDF/Excel) to include Results Framework columns.'),
          subHeading('Database / model updates (planned)'),
          bullet('Extend activity or submission tables with: target_value, actual_value, performance_status, outcome_reason, practice_type (existing/innovation).'),
          bullet('Optional link table: activity_id ↔ results_framework_indicator_id.'),
          subHeading('Affected areas'),
          bullet('Admin: Standard and Activities, Reports'),
          bullet('HOD: Strategic Activities, Submissions & reviews, Performance & Reports'),
          bullet('Ambassador: Tracking and Reporting sections'),

          sectionHeading('Phase 4 — Milestone-based progress & quantitative indicators'),
          subHeading('Problem'),
          body(
            'Progress is entered manually as percentages. Users want automatic calculation from predefined milestones (e.g. Concept Note 10%, Detailed Proposal 20%, … Approval 100%). They also want numeric indicators (concept notes count, registrations by programme/faculty) feeding dashboards and management reports.'
          ),
          subHeading('What will be changed — milestones'),
          bullet('Define milestone templates per activity type or process (configurable by admin).'),
          bullet('Replace or supplement manual progress % with milestone completion logic.'),
          bullet('Auto-recalculate activity progress when milestones are marked complete.'),
          bullet('Add reports: cumulative progress, pending tasks, historical performance.'),
          subHeading('What will be changed — quantitative indicators'),
          bullet('Add numeric indicator fields on relevant activities/reports.'),
          bullet('Registrar/school units: programme and faculty disaggregation for enrollment indicators.'),
          bullet('Auto-populate unit dashboards and aggregated admin reports from entered counts.'),
          subHeading('Affected areas'),
          bullet('Processes/subtasks, department-head tasks, staff submissions'),
          bullet('Ambassador Programme/Course Enrollment panels'),
          bullet('Dashboard stats APIs and report generators'),

          sectionHeading('Phase 1 (continued) — HR system boundaries'),
          subHeading('Problem'),
          body(
            'The M&E system must not duplicate HRMS. Unit Heads and Ambassadors should see only workload-related staff information; full biodata remains for HR Ambassador only.'
          ),
          subHeading('What will be changed'),
          bullet('Restrict Staff Profiles tab to HR Ambassador role (or equivalent HR-scoped role).'),
          bullet('For ambassadors and HODs: show name, designation, assigned tasks, and progress only — hide contract, biodata, PwD, and other sensitive HR fields.'),
          bullet('Update lib/ambassador/faculty-staff-profiles.ts and staff list APIs to return a reduced field set by role.'),
          bullet('Keep HR sync (lib/hrms/sync-user.ts) for backend data; limit what each role can view in the UI.'),

          sectionHeading('Summary of changes by area'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ['Area', 'Change', 'Main modules'].map((t) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: t, bold: true, size: 18 })],
                      }),
                    ],
                  })
                ),
              }),
              planRow(
                'Access control',
                'Strict unit scoping for ambassador and HOD; no cross-unit data',
                'lib/ambassador/*, API routes, middleware'
              ),
              planRow(
                'Ambassador UI',
                'Sidebar → Tracking + Reporting + Propose changes',
                'Sidebar.tsx, AmbassadorDashboard, AmbassadorReports'
              ),
              planRow(
                'Reporting logic',
                'Results Framework targets, performance status, narratives',
                'Activities, submissions, report panels'
              ),
              planRow(
                'Progress engine',
                'Milestone templates; auto % calculation',
                'Processes, tasks, submissions APIs'
              ),
              planRow(
                'Indicators',
                'Numeric counts; dashboard/report aggregation',
                'Enrollment panels, dashboard APIs, reports'
              ),
              planRow(
                'HR visibility',
                'Role-based staff field masking',
                'staff-profiles API, ambassador/HOD staff views'
              ),
            ],
          }),

          sectionHeading('Out of scope (for this plan)'),
          bullet('Replacing or rebuilding the external HRMS.'),
          bullet('Changing university-wide Results Framework content (targets set by management; system will display and report against them).'),
          bullet('Database migration of historical manual progress values (will be preserved; new logic applies going forward).'),

          sectionHeading('Next steps'),
          bullet('Confirm phase priorities with ICT and Strategy & Projects.'),
          bullet('Begin Phase 1 security audit on hosted server (mubsme.mubs.ac.ug).'),
          bullet('Approve proposed ambassador menu structure before UI refactor.'),
          bullet('Define Results Framework indicator mapping with Strategy team.'),
          bullet('Pilot milestone templates on one activity type before full rollout.'),
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
