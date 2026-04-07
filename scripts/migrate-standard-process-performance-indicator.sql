-- Run on MySQL/MariaDB after standard_processes exists.
-- Optional text: what shows this process is complete (evidence / deliverable).

ALTER TABLE `standard_processes`
  ADD COLUMN `performance_indicator` VARCHAR(512) NULL;
