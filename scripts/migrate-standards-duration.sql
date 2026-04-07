-- Adds Standard-level duration fields (process duration).
-- Run once on MySQL/MariaDB.
ALTER TABLE `standards`
  ADD COLUMN `duration_value` int DEFAULT NULL,
  ADD COLUMN `duration_unit` varchar(32) DEFAULT NULL;

