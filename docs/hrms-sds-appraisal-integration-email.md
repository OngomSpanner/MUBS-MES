Subject: SDS data for HRMS Appraisal Section B

Hello,

The M&E System now provides a read-only API that HRMS can use to load the Service Delivery Standard (SDS) process activities assigned to a staff member. These records provide the source data for Section B of the appraisal form.

Production API

Base URL: https://mubsme.mubs.ac.ug

Endpoint:
GET https://mubsme.mubs.ac.ug/api/sds/hrm/appraisal-assignments?hrmsStaffId=12345

Please send one staff identifier per request. `hrmsStaffId` is preferred because it is the HRMS-to-M&E identity link. The endpoint also accepts `staffNumber`, `email`, or `userId`.

Authentication

This is a server-to-server API. Please send either one of the following headers:

Authorization: Bearer <SDS_HRM_PULL_SECRET>

or

x-api-key: <SDS_HRM_PULL_SECRET>

Temporary integration secret for testing:

8c033b3b2a84b4bcdcf3d8de351cc2f7658b355be6809a51

Use the value above in place of `<SDS_HRM_PULL_SECRET>`. We are sharing this test secret separately for integration testing and will rotate it after testing. Please keep it in HRMS server configuration only; do not expose it in browser JavaScript or to end users.

Section B field mapping

HRMS column: Pillar
M&E response field: `entries[].standard.pillar`

HRMS column: Output
M&E response field: `entries[].output.service_description`

HRMS column: Key performance outputs
M&E response field: `entries[].key_performance_output`

HRMS column: Performance Indicator
M&E response field: `entries[].performance_indicators`

HRMS column: Performance targets
M&E response field: `entries[].performance_targets`
If HRMS needs individual target values, use `entries[].target_details`.

Each item in `entries` is one active SDS process-activity assignment. The response also includes IDs and codes, such as `assignment_id`, `activity.id`, `output.id`, `output.output_code`, and `standard.id`, for traceability.

Where M&E has no indicator or target details, the relevant value will be an empty array or `null`. The API does not create values that are not maintained in the SDS catalogue.

Ratings and comments

Predetermined Rating, Self Rating, Supervisor Rating, Agreed Rating, and all appraisal comments remain in HRMS. This API is read-only and does not provide write endpoints for those fields.

Quick test

curl -H "Authorization: Bearer 8c033b3b2a84b4bcdcf3d8de351cc2f7658b355be6809a51" "https://mubsme.mubs.ac.ug/api/sds/hrm/appraisal-assignments?hrmsStaffId=12345"

Please let us know if you need a test staff record or help validating the mapping on the appraisal screen.
