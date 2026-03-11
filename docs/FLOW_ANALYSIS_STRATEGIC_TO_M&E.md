# Flow Analysis: Strategic Objective → Monitoring & Evaluation

This document checks whether the system implements the intended end-to-end flow:

```
Strategic Objective
      ↓
Strategic Activity
      ↓
Committee Approval
      ↓
Manager Strategy
      ↓
Dean / HOD
      ↓
Staff Tasks
      ↓
Reports
      ↓
Monitoring & Evaluation
```

---

## 1. Strategic Objective

**Intended:** Plan-level strategic objectives that guide activities.

**Current implementation:**

- **Defined in:** `lib/strategic-plan.ts`
  - **Strategic Pillars (2025–2030):** Research, Innovation & Community Engagement; Equity & Social Safeguards; Human Capital & Sustainability; Partnerships & Internationalisation
  - **Core Objectives:** Digital Advancement; Academic Quality; Infrastructure Investment; Governance & Accountability
- **Usage:** Every strategic activity (and committee proposal) links to a **pillar** and optionally a **core objective**. These are used in:
  - Admin: Create/Edit Activity modal (`CreateActivityModal.tsx`)
  - Committee: Propose form (`CommPropose.tsx`)
  - Strategic list/detail views and filters

**Verdict:** ✅ **Aligned.** Strategic objectives exist as plan-level constants; activities are explicitly linked via `pillar` and `core_objective`. There is no separate “Strategic Objective” entity/table—objectives are the pillars + core objectives, and activities reference them.

---

## 2. Strategic Activity

**Intended:** Concrete activities derived from strategic objectives.

**Current implementation:**

- **Table:** `strategic_activities` (with `pillar`, `core_objective`, `department_id`, `parent_id`, etc.)
- **Creation paths:**
  1. **Admin / Strategy Manager:** Create activity at `/admin?pg=strategic` via `CreateActivityModal` → `POST /api/activities`. Can assign to one or more departments (`department_id` or `department_ids`).
  2. **Committee → Principal approval:** When Principal approves a committee proposal, `PATCH /api/principal/committee-proposals/[id]` creates a row in `strategic_activities` with `department_id` from the proposal.

**Verdict:** ✅ **Aligned.** Strategic activities are the central entity; they are created either by Manager Strategy (admin) or by the Committee Approval path (Principal approval).

---

## 3. Committee Approval

**Intended:** Committee proposals are reviewed and approved before becoming formal activities.

**Current implementation:**

- **Committee:** Submits proposals at `/comm?pg=propose` → `POST /api/comm/proposals` (with pillar, committee type, suggested department, etc.).
- **Admin:** Can view all proposals at `/admin?pg=committee` (view-only in terms of approval).
- **Principal:** Reviews at `/principal?pg=executive` (“Committee proposals pending your review”). Actions: **Approve** or **Reject** via `PATCH /api/principal/committee-proposals/[id]`.
- **On Approve:** A `strategic_activity` is created with `department_id` from the proposal (and optional `meeting_reference`, `committee_suggestion_unit_id`).

**Verdict:** ✅ **Aligned.** Committee proposes → Principal approves/rejects; approval creates a strategic activity (with department assignment). Committee pending page is view-only; approval is only on the Principal page.

---

## 4. Manager Strategy

**Intended:** Strategy management layer that creates/assigns activities to departments.

**Current implementation:**

- **Role:** “Strategy Manager” (and “System Administrator”) map to admin dashboard: `lib/role-routing.ts` → `/admin`.
- **Capabilities:**
  - Create strategic activities with pillar, core objective, KPI, timeline, and **department(s)** at `/admin?pg=strategic`.
  - Reassign or edit activities (including department).
  - View committee proposals (no approval there; Principal approves).
- **Data flow:** Activities created or approved with a `department_id` are visible to the HOD of that department (see below).

**Verdict:** ✅ **Aligned.** “Manager Strategy” is implemented as Strategy Manager / Admin: creates and assigns strategic activities to departments. For committee-originated activities, assignment is done at approval time (Principal sets `department_id` from the proposal), so no separate Manager Strategy step is required for that path.

---

## 5. Dean / HOD

**Intended:** Activities assigned to a department automatically appear for the Dean/HOD; HOD manages execution and staff tasks.

**Current implementation:**

- **Visibility:** HOD sees activities where `strategic_activities.department_id IN (visible department IDs)`. Visible departments come from `lib/department-head.ts` → `getVisibleDepartmentIds(userId)` (user’s `department_id` and any child departments).
- **APIs:**
  - **Dashboard:** `GET /api/dashboard/department-head` — stats and activity progress for those departments.
  - **Activities:** `GET /api/department-head/activities` — main activities (`parent_id IS NULL`) and child tasks in those departments.
- **HOD actions:**
  - Create **tasks** (child `strategic_activities` with `parent_id` = main activity) via `POST /api/department-head/tasks`.
  - Optionally **assign task to staff** → creates `activity_assignments` (activity_id, assigned_to_user_id, assigned_by).
  - Manage tasks (edit, mark complete, reassign) via `PUT /api/department-head/tasks`.

**Verdict:** ✅ **Aligned.** When an activity is assigned to a department (by Admin or via committee approval), it appears on the HOD dashboard and in Department Activities. Structure is: Strategic Objective → Strategic Activity → (Committee Approval) → Manager Strategy (assign to dept) → **Dean/HOD** sees it and creates tasks/assignments.

---

## 6. Staff Tasks

**Intended:** Staff receive tasks from HOD and work on them.

**Current implementation:**

- **Source of truth:** `activity_assignments` (links `activity_id` → `assigned_to_user_id`). The activity is typically a **child** `strategic_activity` (task) created by HOD.
- **Staff API:** `GET /api/staff/tasks` returns tasks where `activity_assignments.assigned_to_user_id = current user`, joined with `strategic_activities` and department.
- **Staff UI:** `/staff` (e.g. Tasks view) shows assigned tasks, status, due date, and allows submitting reports.

**Verdict:** ✅ **Aligned.** Staff tasks are HOD-created child activities plus `activity_assignments`; staff see and act on them via `/api/staff/tasks` and the staff UI.

---

## 7. Reports

**Intended:** Staff submit progress/achievement reports against their tasks.

**Current implementation:**

- **Table:** `staff_reports` with `activity_assignment_id` (links to `activity_assignments`).
- **Submission:** Staff submit via `POST /api/staff/submissions` (report tied to an assignment). Optional attachments/evidence.
- **Consumption:**
  - HOD: `GET /api/department-head/submissions` — reports for assignments under their department’s activities.
  - Admin/Principal: Reports and analytics APIs use `staff_reports` joined with `activity_assignments` and `strategic_activities`.
- **UI:** Staff submit report flow; HOD views in Department Submissions; Admin has Reports view; Principal has reporting/analytics.

**Verdict:** ✅ **Aligned.** Reports are tied to assignments (and thus to strategic activities and departments); flow is Staff Tasks → Reports.

---

## 8. Monitoring & Evaluation

**Intended:** Track progress, delays, and evaluate performance across the chain.

**Current implementation:**

- **Tracking API:** `GET /api/tracking` — department-level progress, delayed activities, escalation/reminder support.
- **Principal dashboard:** `GET /api/dashboard/principal` — KPIs, compliance by department, risk alerts, overdue activities, committee proposals.
- **Analytics:** `GET /api/principal/analytics` (and related) for higher-level metrics.
- **Admin:** Tracking view at `/admin?pg=tracking`; Reports at `/admin?pg=reports`.
- **HOD:** Dashboard and Department views show progress (including from child task completion and reports).

**Verdict:** ✅ **Aligned.** Monitoring and evaluation are implemented via tracking API, principal dashboard, analytics, and admin/HOD views over activities, assignments, and reports.

---

## Summary Table

| Step in flow              | Implemented | Where / How |
|---------------------------|-----------|-------------|
| Strategic Objective       | ✅        | Pillars + core objectives in `lib/strategic-plan.ts`; activities link via `pillar` + `core_objective`. |
| Strategic Activity        | ✅        | `strategic_activities`; created by Admin or by Principal on committee approval. |
| Committee Approval        | ✅        | Committee proposes → Principal approves at `/principal?pg=executive` → creates activity. |
| Manager Strategy          | ✅        | Strategy Manager/Admin creates and assigns activities to departments; committee path assigns on approval. |
| Dean / HOD                | ✅        | HOD sees activities by `department_id`; dashboard + department-head APIs; creates tasks and assignments. |
| Staff Tasks               | ✅        | `activity_assignments` + child activities; staff see via `/api/staff/tasks`. |
| Reports                   | ✅        | `staff_reports` ↔ `activity_assignments`; staff submit; HOD/Admin/Principal consume. |
| Monitoring & Evaluation  | ✅        | `/api/tracking`, principal dashboard, analytics, admin tracking/reports. |

---

## Optional refinements (no gaps)

1. **Strategic Objective as first-class entity:** The system does not have a separate “Strategic Objective” table; objectives are pillars + core objectives. If you ever want objectives as standalone entities (e.g. with targets or owners), that would be an extension; current design is consistent with “objectives define the plan; activities implement them.”
2. **Order of Committee vs Manager Strategy:** In your flow, Committee Approval comes before Manager Strategy. In the app, committee-approved items get their department at approval time; Manager Strategy is the main path for creating and assigning non-committee activities. Both paths feed the same HOD → Staff → Reports → M&E chain.
3. **Automatic appearance in HOD dashboard:** Any activity with `department_id` in the HOD’s visible departments appears in the HOD dashboard and department-head APIs without an extra “assignment” step; this matches the requirement that “when an activity is assigned to a department, it must automatically appear in the HOD dashboard.”

**Conclusion:** The system implements the full flow from Strategic Objective through Monitoring & Evaluation as described above. No missing steps were found; only optional enhancements (e.g. first-class objective entities) could be considered later.
