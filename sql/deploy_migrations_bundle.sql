-- =============================================================================
-- MUBS M&E — consolidated deployment migrations
-- Run once per environment (local, staging, production).
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
-- Section H (ALTER) may print "Duplicate column/key" if already applied — ignore.
-- Section I (UPDATE) is idempotent for Pending → Active.
--
-- After run: pm2 restart <app>  (or restart your Node process)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- A) Reports tabs — strategic priority, JD/workplans, student ratio, enrollment
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_strategic_priority_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  strategic_pillar VARCHAR(255) NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_priority_user_year (user_id, financial_year_key),
  KEY idx_staff_priority_pillar (strategic_pillar),
  KEY idx_staff_priority_year (financial_year_key),
  CONSTRAINT fk_staff_priority_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_strategic_priority_pct (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  strategic_pillar VARCHAR(255) NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  gender_pct DECIMAL(6,2) DEFAULT NULL,
  pwd_pct DECIMAL(6,2) DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_priority_pct (strategic_pillar, financial_year_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_job_description_workplans_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  has_updated TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_jdwp_user_year (user_id, financial_year_key),
  KEY idx_staff_jdwp_year (financial_year_key),
  CONSTRAINT fk_staff_jdwp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_job_description_workplans_pct (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  financial_year_key VARCHAR(16) NOT NULL,
  pct DECIMAL(6,2) DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_jdwp_pct_year (financial_year_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_student_ratio_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  faculty_name VARCHAR(255) DEFAULT NULL,
  department_name VARCHAR(255) DEFAULT NULL,
  programme_name VARCHAR(255) DEFAULT NULL,
  course_unit_name VARCHAR(255) DEFAULT NULL,
  qualification VARCHAR(255) DEFAULT NULL,
  qualification_details VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ssr_user (user_id),
  KEY idx_ssr_faculty (faculty_name),
  KEY idx_ssr_department (department_name),
  KEY idx_ssr_programme (programme_name),
  KEY idx_ssr_course_unit (course_unit_name),
  CONSTRAINT fk_ssr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_programme_enrollment (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  programme_name VARCHAR(255) NOT NULL,
  total_students INT UNSIGNED NOT NULL DEFAULT 0,
  male_count INT UNSIGNED NOT NULL DEFAULT 0,
  female_count INT UNSIGNED NOT NULL DEFAULT 0,
  pwd_count INT UNSIGNED NOT NULL DEFAULT 0,
  pwd_details TEXT DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_programme_enrollment_name (programme_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_course_unit_enrollment (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_unit_name VARCHAR(255) NOT NULL,
  total_students INT UNSIGNED NOT NULL DEFAULT 0,
  male_count INT UNSIGNED NOT NULL DEFAULT 0,
  female_count INT UNSIGNED NOT NULL DEFAULT 0,
  pwd_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_unit_enrollment_name (course_unit_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- B) Ambassador staff reports — payments & benefits
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_payment_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  payment_type ENUM('wages', 'salaries', 'pension', 'gratuity') NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_payment (user_id, financial_year_key, payment_type),
  KEY idx_staff_payment_year (financial_year_key),
  KEY idx_staff_payment_type (payment_type),
  CONSTRAINT fk_staff_payment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_benefit_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  benefit_type ENUM(
    'medical_refund',
    'nssf',
    'wedding_transport',
    'obituary',
    'workmanship_compensation',
    'biological_scheme'
  ) NOT NULL,
  received TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_benefit (user_id, financial_year_key, benefit_type),
  KEY idx_staff_benefit_year (financial_year_key),
  KEY idx_staff_benefit_type (benefit_type),
  CONSTRAINT fk_staff_benefit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- C) Workforce assessments & employment/skill status (ambassador-scoped schema)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_workforce_assessment_counts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  managed_unit_id INT NULL,
  assessment_detail VARCHAR(255) NOT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  count_value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workforce_assessment_unit (managed_unit_id, assessment_detail, financial_year_key),
  KEY idx_workforce_assessment_year (financial_year_key),
  KEY idx_workforce_managed_unit (managed_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_employment_skill_status (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  managed_unit_id INT NULL,
  financial_year_key VARCHAR(16) NOT NULL,
  reports_produced INT NOT NULL DEFAULT 0,
  skills_missing INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employment_skill_unit_year (managed_unit_id, financial_year_key),
  KEY idx_employment_skill_managed_unit (managed_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- D) Staff development & miscellaneous counts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_development_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  academic_year_key VARCHAR(16) NOT NULL,
  education_level VARCHAR(120) DEFAULT NULL,
  programme VARCHAR(255) DEFAULT NULL,
  training_status ENUM('completed', 'ongoing') DEFAULT NULL,
  is_recommended TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_dev_user_year (user_id, academic_year_key),
  KEY idx_staff_dev_year (academic_year_key),
  CONSTRAINT fk_staff_dev_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_training_implementation (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_year_key VARCHAR(16) NOT NULL,
  completed_count INT NOT NULL DEFAULT 0,
  ongoing_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_impl_year (academic_year_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_miscellaneous_counts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  financial_year_key VARCHAR(16) NOT NULL,
  metric_type ENUM(
    'staff_trainings',
    'hr_system_upgrades',
    'hr_development_plans',
    'hr_audits'
  ) NOT NULL,
  count_value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_misc_year_metric (financial_year_key, metric_type),
  KEY idx_misc_year (financial_year_key),
  KEY idx_misc_metric (metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- H) Upgrade path — older DBs created before ambassador scoping on workforce/skills
--     Skip errors if column/index already exists.
-- -----------------------------------------------------------------------------

-- workforce: add managed_unit_id
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_workforce_assessment_counts'
    AND COLUMN_NAME = 'managed_unit_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE staff_workforce_assessment_counts ADD COLUMN managed_unit_id INT NULL AFTER id, ADD KEY idx_workforce_managed_unit (managed_unit_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- workforce: replace unique key
SET @idx_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_workforce_assessment_counts'
    AND INDEX_NAME = 'uq_workforce_assessment'
);
SET @sql := IF(
  @idx_old > 0,
  'ALTER TABLE staff_workforce_assessment_counts DROP INDEX uq_workforce_assessment',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_workforce_assessment_counts'
    AND INDEX_NAME = 'uq_workforce_assessment_unit'
);
SET @sql := IF(
  @idx_new = 0,
  'ALTER TABLE staff_workforce_assessment_counts ADD UNIQUE KEY uq_workforce_assessment_unit (managed_unit_id, assessment_detail, financial_year_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- employment/skill: add managed_unit_id
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_employment_skill_status'
    AND COLUMN_NAME = 'managed_unit_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE staff_employment_skill_status ADD COLUMN managed_unit_id INT NULL AFTER id, ADD KEY idx_employment_skill_managed_unit (managed_unit_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- employment/skill: replace unique key
SET @idx_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_employment_skill_status'
    AND INDEX_NAME = 'uq_employment_skill_year'
);
SET @sql := IF(
  @idx_old > 0,
  'ALTER TABLE staff_employment_skill_status DROP INDEX uq_employment_skill_year',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_employment_skill_status'
    AND INDEX_NAME = 'uq_employment_skill_unit_year'
);
SET @sql := IF(
  @idx_new = 0,
  'ALTER TABLE staff_employment_skill_status ADD UNIQUE KEY uq_employment_skill_unit_year (managed_unit_id, financial_year_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- development: training_status column (legacy installs)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_development_entries'
    AND COLUMN_NAME = 'training_status'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE staff_development_entries ADD COLUMN training_status ENUM(''completed'', ''ongoing'') DEFAULT NULL AFTER programme',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- I) Account login status — default Active; activate existing Pending accounts
--     (users.status controls login; distinct from employment_status)
-- -----------------------------------------------------------------------------

ALTER TABLE users
  MODIFY COLUMN status ENUM('Active', 'Suspended', 'Pending') NOT NULL DEFAULT 'Active';

UPDATE users
SET status = 'Active'
WHERE status = 'Pending';

-- =============================================================================
-- Done. Verify:
--   SHOW TABLES LIKE 'staff_%';
--   SELECT status, COUNT(*) FROM users GROUP BY status;
-- =============================================================================
