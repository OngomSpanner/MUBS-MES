-- Add submitted_by name and position-at-committee to committee_proposals.
-- submitted_by_name: name of submitter (snapshot). submitted_by_position: optional current job (from users).
-- committee_position: role in the committee (e.g. Secretary, Chair) - from form, not user's job.
-- Run this on your database before using the new proposal form.

ALTER TABLE committee_proposals ADD COLUMN submitted_by_name VARCHAR(200) DEFAULT NULL;
ALTER TABLE committee_proposals ADD COLUMN submitted_by_position VARCHAR(200) DEFAULT NULL;
ALTER TABLE committee_proposals ADD COLUMN committee_position VARCHAR(200) DEFAULT NULL;
