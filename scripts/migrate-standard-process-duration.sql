-- Optional: expected duration per process on a standard template.
-- Run against your SPS database if these columns are not present yet.

ALTER TABLE `standard_processes`
  ADD COLUMN `duration_value` INT NULL DEFAULT NULL AFTER `step_order`,
  ADD COLUMN `duration_unit` VARCHAR(24) NULL DEFAULT NULL AFTER `duration_value`;
