-- Backfill and enforce Standard duration is always present.
-- Financial year timeline is separate; this duration drives process task due dates (start + duration).
--
-- Run once on MySQL/MariaDB.

-- 1) Backfill any missing/invalid values
UPDATE `standards`
SET
  `duration_value` = CASE
    WHEN `duration_value` IS NULL OR `duration_value` < 1 THEN 1
    ELSE `duration_value`
  END,
  `duration_unit` = CASE
    WHEN `duration_unit` IS NULL OR TRIM(`duration_unit`) = '' THEN 'weeks'
    ELSE LOWER(TRIM(`duration_unit`))
  END;

-- 2) Enforce NOT NULL + defaults going forward
ALTER TABLE `standards`
  MODIFY `duration_value` int NOT NULL DEFAULT 1,
  MODIFY `duration_unit` varchar(32) NOT NULL DEFAULT 'weeks';

