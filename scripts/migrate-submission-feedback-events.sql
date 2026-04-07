-- Append-only HOD/staff feedback timeline per staff report (run once on MySQL/MariaDB).
CREATE TABLE IF NOT EXISTS `submission_feedback_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_report_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_staff_report` (`staff_report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
