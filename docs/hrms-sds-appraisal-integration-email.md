Subject: SDS assignments for HRMS appraisal Section B

Hello,

The M&E system now provides a read-only API for HRMS to load Service Delivery Standard (SDS) process activities assigned to a staff member. These records can populate the source fields for Section B of the appraisal form.

Endpoint

Use the M&E production base URL with:

`GET /api/sds/hrm/appraisal-assignments?hrmsStaffId={hrms_staff_id}`

For example:

`https://{m-e-production-base-url}/api/sds/hrm/appraisal-assignments?hrmsStaffId=123`

The endpoint can alternatively look up the staff member with `staffNumber`, `email`, or `userId`. Please provide one identifier per request. `hrmsStaffId` is preferred because it is the HRMS-to-M&E identity link.

Authentication

This is a server-to-server pull API. Send either of these headers with the shared `SDS_HRM_PULL_SECRET` value:

```text
Authorization: Bearer <SDS_HRM_PULL_SECRET>
```

or:

```text
x-api-key: <SDS_HRM_PULL_SECRET>
```

Do not call this from browser JavaScript or expose the shared secret to users.

Example response

```json
{
  "api_version": "1.1",
  "status_filter": "active",
  "staff": {
    "user_id": 42,
    "hrms_staff_id": 123,
    "staff_number": "MUBS-00123",
    "email": "staff@example.mubs.ac.ug",
    "name": "Example Staff",
    "department_id": 8,
    "department": "Finance"
  },
  "entries": [
    {
      "assignment_id": 501,
      "status": "active",
      "standard": {
        "id": 10,
        "code": "P1-FIN-01",
        "title": "Financial management standard",
        "pillar": "Pillar 1",
        "pillar_code": "P1"
      },
      "output": {
        "id": 70,
        "output_code": "P1-FIN-01-O01",
        "sequence": 1,
        "service_description": "Timely processing of supplier payments"
      },
      "activity": {
        "id": 300,
        "name": "Verify supporting documents",
        "sequence": 2,
        "duration_text": "2 working days",
        "duration_days": 2
      },
      "key_performance_output": "Verify supporting documents",
      "performance_indicators": [
        "Percentage of eligible invoices processed within the agreed timeline"
      ],
      "performance_targets": "Due: 2026-12-15; Duration: 2 working days; Quality: Complete and accurate documentation; Frequency: Daily; Coverage: All eligible invoices",
      "target_details": {
        "target_date": "2026-12-15",
        "duration_text": "2 working days",
        "duration_days": 2,
        "quality_standard": "Complete and accurate documentation",
        "frequency": "Daily",
        "coverage": "All eligible invoices"
      },
      "department": {
        "id": 8,
        "name": "Finance"
      }
    }
  ]
}
```

Field mapping for Section B

| HRMS field | M&E response field |
| --- | --- |
| Pillar | `entry.standard.pillar` |
| Output | `entry.output.service_description` |
| Key performance outputs | `entry.key_performance_output` or `entry.activity.name` |
| Performance Indicator | `entry.performance_indicators` |
| Performance targets | `entry.performance_targets`; use `entry.target_details` if separate target columns are needed |

Each `entries` item is one active assignment of one process activity. `assignment_id`, `activity.id`, `output.id`, `output.output_code`, and `standard.id` are supplied for reliable joining and traceability.

When no target details or indicators are maintained in M&E, the relevant field is `null` or an empty array. The API does not generate ratings, indicators, or targets that are not in the SDS catalogue.

HRMS remains responsible for Predetermined Rating, Self Rating, Supervisor Rating, Agreed Rating, and all appraisal comments. This API does not provide write endpoints for those fields.

Please let us know if you would like a test staff record or need help validating the mapping in the appraisal screen.
