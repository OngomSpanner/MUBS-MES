# SPS3 System Analysis

This document summarizes the current state of the Strategic Planning System (SPS3) after codebase exploration and alignment with the intended flows.

---

## 1. System overview

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, MySQL (mysql2), Bootstrap/React-Bootstrap, JWT auth.
- **Purpose:** Role-based strategic plan management: objectives → activities → committee proposals → HOD assignment → staff tasks → reports → evaluations and monitoring.

---

## 2. Application structure

| Area | Route | Main use |
|------|--------|----------|
| **Login** | `/` | Email/password + Google OAuth; redirects to role dashboard when logged in. |
| **Admin** | `/admin` | Strategy Manager / System Administrator. Pages: dashboard, strategic activities, committee proposals, tracking, users, reports. |
| **Committee** | `/comm` | Committee members: dashboard, propose activity, my/pending/approved/rejected proposals, notifications. |
| **Principal** | `/principal` | Executive overview, strategic summary, analytics, reports; approves/rejects committee proposals. |
| **Department head** | `/department-head` | HOD: dashboard, activities, tasks, staff, submissions, evaluations. |
| **Staff** | `/staff` | Staff: dashboard, tasks, deadlines, notifications, submit report, submissions, **feedback** (evaluations from HOD). |

Shortcuts: `/strategic`, `/users`, `/tracking`, `/committee`, `/reports` redirect to the corresponding admin sub-page.

---

## 3. Strategic flow (alignment)

The system implements the intended flow as documented in `FLOW_ANALYSIS_STRATEGIC_TO_M&E.md`:

1. **Strategic objective** – Pillars and core objectives in `lib/strategic-plan.ts`; activities link via `pillar` and `core_objective`.
2. **Strategic activity** – Created by Admin or by Principal when approving a committee proposal (`strategic_activities`).
3. **Committee approval** – Committee proposes → Principal approves/rejects at `/principal?pg=executive`; approved proposals create strategic activities.
4. **Manager strategy** – Admin/Strategy Manager creates and assigns activities to departments.
5. **Dean / HOD** – Sees activities for their department(s); creates tasks and assigns staff via `activity_assignments`.
6. **Staff tasks** – Staff see assignments via `/api/staff/tasks` and submit reports.
7. **Reports** – `staff_reports` linked to `activity_assignments`; staff submit; HOD evaluates.
8. **Monitoring & evaluation** – Tracking API, principal dashboard, admin reports (including strategic-plan-overview by pillar and status).

---

## 4. API and data

- **Auth:** Each API route that needs auth reads the `token` cookie and uses `verifyToken()` (no shared middleware). Auth routes: login, logout, me, switch-role, forgot-password, reset-password, Google.
- **Database:** MySQL via `lib/db.ts` (`query({ query, values })`). No ORM. Main tables: `users`, `departments`, `strategic_activities`, `activity_assignments`, `staff_reports`, `evaluations`, `committee_proposals`, `notifications`, `activity_tracking`.
- **Schema drift:** Several routes use try/catch and fallback queries when columns are missing (e.g. `core_objective`, `committee_position`, `submitted_by_name`), so the app can run against older DB versions.

---

## 5. Middleware

- **File:** `middleware.ts`. Does **not** run for paths under `/api`.
- **Behavior:** Requires `token` and `active_role` cookies for `/admin`, `/comm`, `/principal`, `/department-head`, `/staff`. If role does not match the path, redirects to the dashboard for that role. If user is logged in and visits `/`, redirects to role dashboard. Clears cookies and redirects to `/` on invalid/unknown role to avoid redirect loops.

---

## 6. What is working well

- Clear separation of dashboards and APIs by role (admin, comm, principal, department-head, staff).
- Strategic flow from objectives → activities → committee → HOD → staff → reports → evaluation is implemented end-to-end.
- Committee proposal workflow: propose → Principal approve/reject → create strategic activity with department.
- Staff feedback page: staff see HOD evaluations for their reports (API uses `INNER JOIN evaluations` so any evaluated report is listed).
- Reports: activity summary, staff evaluation, trend/strategic-plan-overview (by pillar + status), delayed activities; filters by date and department.
- Shared utilities: `lib/linkify.tsx` (clickable links in modals; file paths as “Download document”), `lib/strategic-plan.ts` (pillars and core objectives), `lib/role-routing.ts` (role normalization and dashboard paths).
- Backward compatibility: several APIs tolerate missing DB columns via fallback queries.

---

## 7. Gaps and risks (resolved)

| Area | Issue | Status |
|------|--------|--------|
| **Debug / migration / seed routes** | `debug-tables`, `debug-schema`, `debug-users`, `debug-departments`, `debug-sa-data`, `migrate-sa`, `migrate-status`, `migrate-users-dept`, `seed-tasks`, `seed-subtasks` are exposed as HTTP APIs. | **Resolved:** `lib/api-guard.ts` → `disallowInProduction()`. All such handlers use it; in production they return 404. |
| **Dead file** | `app/api/committees/[id]/routes.ts` exists next to `route.ts`. App Router uses `route.ts` only. | **Resolved:** Only `route.ts` is used; duplicate removed or not present. |
| **API response shape** | Mixed shapes across routes. | Optional: standardize envelope. |
| **Auth helper** | Each route implemented cookie + verifyToken separately. | **Resolved:** lib/require-auth.ts provides async requireAuth(); returns { userId, role } or 401. Use in new/refactored routes. |
| **Error handling** | Some 401s returned as 500. | Optional: use `requireAuth()` in more routes. |

---

## 8. Database and schema

- **Reference schema:** `public/mubs_super_admin (3).sql` includes `users` (with `position`), `departments`, `strategic_activities`, `activity_assignments`, `staff_reports`, `evaluations`, `committee_proposals`, etc.
- **Migrations:** `public/migrations/` (e.g. strategic plan 2025–2030 pillars, `committee_proposals` submitter/committee_position). Apply as needed for new columns/enums.
- **Pillar alignment:** If the DB still has the old pillar enum, the reports “by pillar” view uses whatever pillar values exist; after running the strategic plan migration, the four 2025–2030 pillars are used.

---

## 9. Summary

The system is **coherent and aligned** with the intended strategic flow. Core features (objectives, activities, committee proposals, HOD tasks and evaluations, staff reports and feedback, monitoring and reports) are in place. **Gaps addressed:** debug/migrate/seed endpoints are disabled in production via `disallowInProduction()`; dead `routes.ts` removed or absent; `requireAuth()` helper added for consistent API auth. Optional follow-ups: standardize API response shapes and use `requireAuth()` in more routes.
