-- Bundled SQL migrations for newly added Reports tabs.
-- Run this once on your hosted MySQL server.
--
-- Recommended: execute as a user with privileges to create tables and foreign keys.
-- Engine/charset matches app conventions.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Strategic Priority (% of staff in strategic priority areas)
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

-- 2) % of staff with updated job description and workplans
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

-- 3) Staff-Student Ratio (teaching staff listing by programme/course unit)
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

-- 4) Programme Enrollment (number of students in each programme)
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

-- 5) Course Unit Enrollment (course unit and number of students enrolled)
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

SET FOREIGN_KEY_CHECKS = 1;

