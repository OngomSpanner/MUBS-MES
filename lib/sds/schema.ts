import { query } from '@/lib/db';

let ensured = false;

/** Idempotent SDS schema ensure (safe for live). */
export async function ensureSdsSchema(): Promise<void> {
  if (ensured) return;

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS sds_standards (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(120) NOT NULL,
        title VARCHAR(500) NOT NULL,
        owner_department_id INT NULL,
        owner_label VARCHAR(255) NULL,
        supporting_units TEXT NULL,
        pathway TEXT NULL,
        user_fee TEXT NULL,
        purpose TEXT NULL,
        objectives_json JSON NULL,
        pillar VARCHAR(255) NULL,
        pillar_code VARCHAR(16) NULL,
        objective_code VARCHAR(16) NULL,
        owner_code VARCHAR(64) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sds_standard_code (code),
        KEY idx_sds_standards_owner_dept (owner_department_id),
        KEY idx_sds_standards_pillar (pillar)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS sds_outputs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        standard_id INT UNSIGNED NOT NULL,
        output_code VARCHAR(160) NOT NULL,
        sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
        service_description TEXT NOT NULL,
        performance_indicators_json JSON NULL,
        quality_standard TEXT NULL,
        access_standard TEXT NULL,
        coverage TEXT NULL,
        frequency TEXT NULL,
        process_text TEXT NULL,
        target_beneficiary TEXT NULL,
        access_criteria TEXT NULL,
        methodology TEXT NULL,
        inputs TEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sds_output_code (output_code),
        KEY idx_sds_outputs_standard (standard_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS sds_activities (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        output_id INT UNSIGNED NOT NULL,
        sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
        activity_name VARCHAR(500) NOT NULL,
        duration_text VARCHAR(120) NULL,
        duration_days INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sds_activities_output (output_id),
        UNIQUE KEY uq_sds_activity_output_seq (output_id, sequence_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS sds_activity_assignments (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        activity_id INT UNSIGNED NOT NULL,
        staff_user_id INT NOT NULL,
        assigned_by INT NULL,
        department_id INT NULL,
        assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        target_date DATE NULL,
        notes TEXT NULL,
        status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
        cancelled_at TIMESTAMP NULL,
        cancelled_by INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sds_assign_activity (activity_id),
        KEY idx_sds_assign_staff (staff_user_id),
        KEY idx_sds_assign_status (status),
        KEY idx_sds_assign_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS sds_indicator_reports (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        standard_id INT UNSIGNED NOT NULL,
        output_id INT UNSIGNED NULL,
        department_id INT NOT NULL,
        reported_by INT NOT NULL,
        reporting_period VARCHAR(64) NOT NULL,
        indicator_text VARCHAR(1000) NOT NULL,
        value_text VARCHAR(500) NULL,
        comment TEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sds_pi_standard (standard_id),
        KEY idx_sds_pi_dept (department_id),
        KEY idx_sds_pi_period (reporting_period)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  // Widen legacy VARCHAR user_fee if needed (idempotent)
  try {
    await query({
      query: `ALTER TABLE sds_standards MODIFY COLUMN user_fee TEXT NULL`,
    });
  } catch {
    /* column already TEXT or table missing until create above */
  }
  ensured = true;
}
