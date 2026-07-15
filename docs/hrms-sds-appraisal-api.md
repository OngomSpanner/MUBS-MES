# HRMS SDS appraisal pull API

## Purpose

`GET /api/sds/hrm/appraisal-assignments` exposes the active SDS process activities assigned to one M&E user. It is a read-only, server-to-server integration for HRMS appraisal Section B.

The response is an assignment catalogue. It does not contain performance report values, appraisal ratings, or comments.

## Authentication

Set `SDS_HRM_PULL_SECRET` in the M&E production environment. HRMS must send the same value in one header:

```http
Authorization: Bearer <SDS_HRM_PULL_SECRET>
```

or:

```http
x-api-key: <SDS_HRM_PULL_SECRET>
```

`CRON_SECRET` is accepted only as a legacy fallback. Use the dedicated `SDS_HRM_PULL_SECRET` for this integration.

The endpoint intentionally does not enable cross-origin browser access. HRMS should call it from its backend so the secret is never exposed to a browser.

## Lookup query parameters

Supply one of the following:

- `hrmsStaffId`: preferred numeric HRMS staff ID, matched to `users.hrms_staff_id`
- `staffNumber`: matched to `users.employee_id` or a numeric `hrms_staff_id`
- `email`: matched to `users.email`
- `userId`: M&E `users.id`

Example:

```text
GET {m-e-production-base-url}/api/sds/hrm/appraisal-assignments?hrmsStaffId=123
```

## Response contract

The response is versioned as `api_version: "1.1"` and returns only assignments whose status is `active`.

Each `entries[]` value is one process-activity assignment:

- `staff`: resolved M&E and HRMS identity plus staff department
- `standard`: standard ID, code, title, pillar, and pillar code
- `output`: output ID, code, service description, and sequence
- `activity`: process activity ID, name, sequence, and duration
- `assignment_id`, `assigned_at`, `target_date`, `notes`, `status`, `department`: assignment traceability
- `key_performance_output`: the activity name for the HRMS Key performance outputs column
- `performance_indicators`: array copied from the owning output's SDS indicators
- `performance_targets`: readable summary of available due date, duration, quality standard, frequency, and coverage; `null` when none exist
- `target_details`: individual target fields, each nullable

For compatibility with the earlier endpoint response, flat aliases such as `standard_code`, `standard_title`, `output_code`, `service_description`, `activity_name`, `duration_text`, `performance_output`, and `performance_indicator` remain available. New HRMS work should use the explicit nested fields and `key_performance_output`.

## Section B ownership

| HRMS column | API source |
| --- | --- |
| Pillar | `standard.pillar` |
| Output | `output.service_description` |
| Key performance outputs | `key_performance_output` |
| Performance Indicator | `performance_indicators` |
| Performance targets | `performance_targets` or `target_details` |

Predetermined Rating, Self Rating, Supervisor Rating, Agreed Rating, and comments remain owned and persisted by HRMS. There are no M&E write APIs for these appraisal fields.

## Status and errors

- `200`: staff found; `entries` may be empty when no active assignments exist
- `401`: shared secret is absent, invalid, or not sent
- `404`: no M&E user matched the supplied identity
- `500`: unexpected M&E service or database error
