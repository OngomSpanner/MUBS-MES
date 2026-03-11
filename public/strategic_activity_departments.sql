-- Run this to allow assigning a strategic activity to multiple departments/units.
-- Table: strategic_activity_departments (activity_id, department_id)

CREATE TABLE IF NOT EXISTS `strategic_activity_departments` (
  `activity_id` int NOT NULL,
  `department_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`, `department_id`),
  KEY `department_id` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill: copy existing single assignment from strategic_activities.department_id
INSERT IGNORE INTO `strategic_activity_departments` (`activity_id`, `department_id`)
SELECT `id`, `department_id` FROM `strategic_activities` WHERE `department_id` IS NOT NULL;
