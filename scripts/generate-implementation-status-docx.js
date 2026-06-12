/**
 * M&E System — implementation status vs ambassador feedback requirements.
 * Run: node scripts/generate-implementation-status-docx.js
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
  BorderStyle,
} = require('docx');

const OUT_DIR = 'D:\\letters report doc';
const OUT_FILE = 'M_E_System_Implementation_Status_and_Access.docx';

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function statusLine(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  });
}

function accessLine(role, url, description) {
  return bullet(`${role} — ${url} — ${description}`);
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
                text: 'MUBS M&E System',
                bold: true,
                size: 36,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'Implementation Status, Access Guide & Gaps',
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [new TextRun({ text: dateStr, size: 22, italics: true })],
          }),

          body(
            'This document records what has been implemented in the M&E system against the Strategic Plan Ambassador feedback (Phases 1–4), how each role can access the features on the live application, and what remains incomplete. SQL for hosted deployment is consolidated in sql/deploy_migrations_bundle.sql.'
          ),

          subHeading('Summary scorecard'),
          statusLine('1. Unit data isolation', 'Partially implemented'),
          statusLine('2. Simplified ambassador navigation', 'Largely implemented'),
          statusLine('3. Results Framework reporting', 'Partially implemented'),
          statusLine('4. Milestone-based automatic progress', 'Partially implemented'),
          statusLine('5. Quantitative performance indicators', 'Partially implemented'),
          statusLine('6. HR system boundaries', 'Partially implemented'),

          sectionHeading('1. Strict data isolation between units'),
          statusLine('Overall status', 'PARTIAL — ambassador and HOD routes are scoped; Principal portal not built; some APIs are university-wide'),
          subHeading('What was done'),
          bullet('Ambassador APIs filter by users.managed_unit_id and child departments (lib/ambassador/managed-unit-departments.ts).'),
          bullet('Ambassador dashboard, activity progress, compliance, Results Framework, milestones, and report APIs enforce unit scope.'),
          bullet('Ambassador HR report types in /api/reports are restricted to the ambassador’s assigned unit (lib/ambassador/reports-scope.ts).'),
          bullet('Head of Department (HOD) / Unit Head routes use getVisibleDepartmentIds() — own department tree only (lib/department-head.ts).'),
          bullet('Strategy & Projects Planner uses System Administrator / Strategy Manager role → /admin (university-wide by design).'),
          bullet('Workforce and employment/skill tables include managed_unit_id (SQL section H in deploy_migrations_bundle.sql).'),
          subHeading('How to access (verify isolation)'),
          accessLine('Strategic Plan Ambassador', '/ambassador', 'Login as Ambassador; sidebar shows only your unit’s data.'),
          accessLine('HOD / Unit Head', '/department-head', 'Strategic Activities, Processes, Reports — department tree only.'),
          accessLine('Strategy Manager / S&P Planner', '/admin', 'Activity Tracking, Reports & Monitoring — university-wide.'),
          subHeading('Gaps / not done'),
          bullet('Principal role: login redirects to /principal but no Principal portal exists in the application.'),
          bullet('/api/tracking returns all departments for any authenticated user (admin UI only today; API not role-scoped).'),
          bullet('Phase 1 “strict isolation everywhere” was deferred per project direction; cross-unit leaks should be re-audited if still reported.'),

          sectionHeading('2. Simplified ambassador navigation'),
          statusLine('Overall status', 'LARGELY DONE'),
          subHeading('What was done'),
          bullet('Sidebar reduced to three top-level items: Tracking, Reporting, Propose Changes (components/Sidebar.tsx).'),
          bullet('Former many menu items are now tabs inside Tracking and Reporting.'),
          subHeading('How to access'),
          accessLine('Tracking', '/ambassador?pg=tracking&tab=dashboard', 'Tabs: Dashboard | Activity progress | Results Framework | Milestones | Risk alerts'),
          accessLine('Activity progress', '/ambassador?pg=tracking&tab=compliance', 'Unit activity list with department filter; due dates from HOD process steps'),
          accessLine('Results Framework', '/ambassador?pg=tracking&tab=results', 'Target vs actual; record ambassador narratives'),
          accessLine('Milestones', '/ambassador?pg=tracking&tab=milestones', 'Auto-calculated milestone progress per activity'),
          accessLine('Risk alerts', '/ambassador?pg=tracking&tab=alerts', 'Overdue / at-risk activities in your unit'),
          accessLine('Reporting', '/ambassador?pg=reporting', 'Tabs: Recruitment, Benefits, Workforce assessments, Employment skills; Registrar tabs if assigned; Staff profiles if HR ambassador'),
          accessLine('Propose Changes', '/ambassador?pg=propose-changes', 'Submit structural/data change requests; admin reviews at /admin?pg=change-requests'),
          subHeading('Gaps'),
          bullet('Feedback asked for “two functions” plus propose changes; implementation uses three sidebar items (Tracking, Reporting, Propose Changes) — functionally equivalent.'),

          sectionHeading('3. Results Framework as primary reporting benchmark'),
          statusLine('Overall status', 'PARTIAL — viewing and classification done; mandatory narratives enforced in UI/export but not all workflows'),
          subHeading('What was done'),
          bullet('Results Framework tables for Ambassador, HOD, and Admin with Target, Expected outcome, Actual, Status (underperformance / achievement / overachievement).'),
          bullet('Classification bands: under 90% of target, 90–110% achievement, above 110% overachievement (lib/results-framework.ts).'),
          bullet('Ambassador narrative modal: outcome reason + Existing practice vs New innovation when targets met/exceeded (components/ResultsFramework/RfNarrativeModal.tsx).'),
          bullet('Staff KPI submissions capture actual value, outcome reason, and practice type on kpi_driver tasks.'),
          bullet('activity_rf_narratives table and staff_reports RF columns (SQL sections J & K).'),
          bullet('Rows missing ambassador narratives are highlighted; export blocked until complete (ambassador/HOD RF Excel).'),
          bullet('KPI actual rollup from staff reports (lib/kpi-actual-rollup.ts); RF query prefers sum of submissions over stale stored actual.'),
          subHeading('How to access'),
          accessLine('Ambassador RF', '/ambassador?pg=tracking&tab=results', 'View indicators; click Record/Required to save narratives'),
          accessLine('HOD / Unit Head RF', '/department-head?pg=reports → Results Framework tab', 'View unit target vs actual; export Excel'),
          accessLine('Strategy Manager / Admin RF', '/admin?pg=reports → Results Framework', 'University-wide; export Excel'),
          accessLine('Admin dashboard RF snapshot', '/admin?pg=dashboard', 'RF indicator counts on dashboard'),
          accessLine('Staff KPI entry', '/staff?pg=tasks → Submit Report', 'On kpi_driver tasks: enter actual + outcome + practice/innovation'),
          subHeading('Gaps'),
          bullet('“Actual” column often shows Not assessed until staff submit KPI values and HOD evaluates.'),
          bullet('Mandatory ambassador narratives: enforced on save validation and export gate — not a global workflow lock on all reporting pages.'),
          bullet('RF is integrated but not yet the sole reporting path for all activity types (process reporting remains parallel).'),

          sectionHeading('4. Automatic progress from standard milestones'),
          statusLine('Overall status', 'PARTIAL — milestone engine and ambassador view done; full historical reporting light'),
          subHeading('What was done'),
          bullet('standard_processes.milestone_progress — cumulative % per step (e.g. 10, 20, … 100); configurable on Admin → Standard and Activities (SQL section K).'),
          bullet('Progress auto-recalculates from highest completed milestone when HOD evaluates submissions (lib/milestone-progress.ts).'),
          bullet('HOD evaluations skip manual 100/50/0 averaging when parent activity has milestone template.'),
          bullet('MilestoneProgressPanel on HOD process views shows step completion and cumulative %.'),
          bullet('Ambassador Milestones tab lists activities with progress, pending steps, expandable step list.'),
          subHeading('How to access'),
          accessLine('Configure milestones', '/admin?pg=strategic', 'Edit standard process steps; set milestone % (auto-fill evenly if blank)'),
          accessLine('HOD milestone detail', '/department-head?pg=tasks', 'Open activity/process — Milestone progress panel when standard has steps'),
          accessLine('Ambassador milestones', '/ambassador?pg=tracking&tab=milestones', 'Read-only unit milestone overview'),
          accessLine('HOD performance trends', '/department-head?pg=reports → Trends tab', 'Submission evaluation trends over time'),
          subHeading('Gaps'),
          bullet('Ambassadors observe progress; staff submit and HOD evaluates — ambassadors do not directly drive milestone completion.'),
          bullet('Manual progress (Complete=100%, Incomplete=50%) still applies for non-milestone tasks.'),
          bullet('Dedicated milestone historical/cumulative reports across all units are not fully built (trends tab is submission-based).'),
          bullet('Example Project Proposal Development percentages are supported as configurable templates, not pre-loaded for every activity.'),

          sectionHeading('5. Quantitative performance indicators'),
          statusLine('Overall status', 'PARTIAL — KPI drivers and enrollment implemented; not universal for all activities'),
          subHeading('What was done'),
          bullet('KPI-driver activities: staff enter numeric kpi_actual_value (e.g. concept notes count) on submission.'),
          bullet('Registrar ambassador: programme enrollment and course-unit enrollment with faculty disaggregation.'),
          bullet('Enrollment KPIs on Admin dashboard and Ambassador dashboard (Strategy Manager oversight).'),
          bullet('Reporting tabs: recruitment, benefits, workforce assessments, employment skill status, student ratio, etc.'),
          bullet('SQL: enrollment tables + faculty_name (section L); reporting tables sections A–D in deploy_migrations_bundle.sql.'),
          subHeading('How to access'),
          accessLine('Ambassador enrollment (Registrar)', '/ambassador?pg=reporting&tab=programme-enrollment', 'Enter programme totals by faculty'),
          accessLine('Ambassador enrollment CU', '/ambassador?pg=reporting&tab=course-unit-enrollment', 'Course unit enrollment by faculty'),
          accessLine('Ambassador quantitative reports', '/ambassador?pg=reporting', 'Recruitment, benefits, workforce, skills tabs'),
          accessLine('Strategy Manager reports', '/admin?pg=reports', 'All HR/M&E report tabs including enrollment faculty breakdown'),
          accessLine('Strategy Manager dashboard', '/admin?pg=dashboard', 'Enrollment + RF summary cards'),
          accessLine('Staff KPI numbers', '/staff?pg=tasks', 'Submit Report on kpi_driver tasks'),
          subHeading('Gaps'),
          bullet('Quantitative capture is not on every activity — mainly kpi_driver tasks and enrollment-style indicators.'),
          bullet('Auto-population into RF “Actual” requires data entry and evaluation; not all indicators flow automatically yet.'),

          sectionHeading('6. HR system boundaries (no HRMS replication)'),
          statusLine('Overall status', 'PARTIAL — HR ambassador gate and HOD workload view done; some items incomplete'),
          subHeading('What was done'),
          bullet('Full staff profiles restricted to HR Ambassador only (lib/ambassador/hr-unit.ts → requireHrAmbassador).'),
          bullet('Non-HR ambassadors see staff names + department only in report dropdowns (lib/ambassador/faculty-staff.ts).'),
          bullet('HOD Staff API slimmed: name, designation, open assignments, workload status — no email, contract, leave, or personal HR fields.'),
          bullet('HOD Staff & Warnings: workload badges (On track, Over-allocated, Underutilized, Falling behind) and Workload alerts section.'),
          bullet('HOD profile modal (mode=hod) shows limited fields: department, designation, sections, open assignments.'),
          subHeading('How to access'),
          accessLine('HR Ambassador staff profiles', '/ambassador?pg=reporting&tab=staff-profiles', 'Only if assigned to Human Resources unit'),
          accessLine('HOD workload view', '/department-head?pg=staff', 'Staff roster + Workload alerts; View profile (limited)'),
          accessLine('HOD assignees on tasks', '/department-head?pg=tasks', 'Staff names on process assignments'),
          subHeading('Gaps'),
          bullet('Unit Head delegation to ambassador (express delegation of unit head role) — not implemented.'),
          bullet('“Overperforming” as distinct workload category — not implemented (only over-allocated, underutilized, falling behind, on track).'),
          bullet('Ambassadors still see staff names in reporting dropdowns for their unit (by design for data entry).'),

          sectionHeading('Hosted server — SQL deployment'),
          body('Run once on the live MySQL database (safe to re-run):'),
          bullet('File: sql/deploy_migrations_bundle.sql (project root)'),
          bullet('Sections A–D: reporting tables; H: ambassador unit scoping; I: user status; J–K: Phase 3 RF; L: Phase 4B enrollment faculty'),
          bullet('Recent code changes (due date, workload, mandatory narrative UI) require NO additional SQL — deploy latest code and restart Node.'),
          body('Verify after SQL:'),
          bullet("SHOW TABLES LIKE 'activity_rf_narratives';"),
          bullet("SHOW COLUMNS FROM staff_reports LIKE 'performance_status';"),
          bullet("SHOW COLUMNS FROM standard_processes LIKE 'milestone_progress';"),
          bullet("SHOW COLUMNS FROM staff_programme_enrollment LIKE 'faculty_name';"),

          sectionHeading('Role quick reference'),
          accessLine('Strategic Plan Ambassador', '/ambassador', 'Tracking + Reporting + Propose Changes'),
          accessLine('Head of Department / Unit Head', '/department-head', 'Activities, Processes, Staff, Reports, Evaluations'),
          accessLine('Strategy Manager / S&P Planner', '/admin', 'Dashboard, Strategic standards, Tracking, Reports, Users'),
          accessLine('Staff', '/staff', 'Tasks, Submissions, Notifications'),
          accessLine('Principal', '/principal', 'NOT IMPLEMENTED — role exists in user management only'),

          body(
            'Document generated from codebase audit. For updates after further development, re-run: node scripts/generate-implementation-status-docx.js'
          ),
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
