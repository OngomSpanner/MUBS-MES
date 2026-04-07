-- Phase 3 optional: remove deprecated columns from `standards`.
-- Per–FY targets and unit of measure belong on `strategic_activities`, not standards.
--
-- Before running:
--   1. Back up the database.
--   2. Ensure no external reports rely on standards.unit_of_measure or standards.target_fy* .
--
-- After running:
--   You may simplify app/api/standards/route.ts POST and app/api/standards/[id]/route.ts PUT
--   to INSERT/UPDATE only (title, quality_standard, output_standard, target).

ALTER TABLE `standards`
  DROP COLUMN `target_fy25_26`,
  DROP COLUMN `target_fy26_27`,
  DROP COLUMN `target_fy27_28`,
  DROP COLUMN `target_fy28_29`,
  DROP COLUMN `target_fy29_30`,
  DROP COLUMN `unit_of_measure`;
