/**
 * Academic teaching data (HOD entry).
 * Run: node scripts/migrate-hr-academic-data.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].c > 0;
}

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function migrateReviewColumns(connection) {
  for (const table of ['academic_course_unit_assignments', 'academic_programme_allocations']) {
    if (!(await tableExists(connection, table))) continue;

    if (!(await columnExists(connection, table, 'hod_comment'))) {
      await connection.execute(
        `ALTER TABLE ${table} ADD COLUMN hod_comment VARCHAR(500) DEFAULT NULL AFTER approved_at`
      );
      console.log(`  added ${table}.hod_comment`);
    }
    if (!(await columnExists(connection, table, 'reviewed_by'))) {
      await connection.execute(
        `ALTER TABLE ${table} ADD COLUMN reviewed_by INT DEFAULT NULL AFTER hod_comment`
      );
      console.log(`  added ${table}.reviewed_by`);
    }
    if (!(await columnExists(connection, table, 'reviewed_at'))) {
      await connection.execute(
        `ALTER TABLE ${table} ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER reviewed_by`
      );
      console.log(`  added ${table}.reviewed_at`);
    }

    await connection.execute(`
      ALTER TABLE ${table}
      MODIFY status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft'
    `);
    console.log(`  ensured ${table}.status includes rejected`);
  }
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('Academic teaching data tables…');

    if (!(await tableExists(connection, 'academic_course_unit_assignments'))) {
      await connection.execute(`
        CREATE TABLE academic_course_unit_assignments (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          department_id INT NOT NULL,
          user_id INT NOT NULL,
          course_unit_code VARCHAR(64) DEFAULT NULL,
          course_unit_name VARCHAR(255) NOT NULL,
          programme_name VARCHAR(255) DEFAULT NULL,
          financial_year_key VARCHAR(16) NOT NULL,
          reporting_period VARCHAR(32) DEFAULT NULL,
          semester_label VARCHAR(64) DEFAULT NULL,
          student_count INT UNSIGNED DEFAULT NULL,
          teaching_hours DECIMAL(8,2) DEFAULT NULL,
          status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
          submitted_by INT DEFAULT NULL,
          approved_by INT DEFAULT NULL,
          approved_at TIMESTAMP NULL DEFAULT NULL,
          hod_comment VARCHAR(500) DEFAULT NULL,
          reviewed_by INT DEFAULT NULL,
          reviewed_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_acu_dept (department_id),
          KEY idx_acu_user (user_id),
          KEY idx_acu_fy (financial_year_key),
          KEY idx_acu_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created academic_course_unit_assignments');
    } else {
      console.log('  skip (exists): academic_course_unit_assignments');
    }

    if (!(await tableExists(connection, 'academic_programme_allocations'))) {
      await connection.execute(`
        CREATE TABLE academic_programme_allocations (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          department_id INT NOT NULL,
          user_id INT NOT NULL,
          programme_name VARCHAR(255) NOT NULL,
          allocation_role VARCHAR(120) DEFAULT NULL,
          financial_year_key VARCHAR(16) NOT NULL,
          reporting_period VARCHAR(32) DEFAULT NULL,
          semester_label VARCHAR(64) DEFAULT NULL,
          status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
          submitted_by INT DEFAULT NULL,
          approved_by INT DEFAULT NULL,
          approved_at TIMESTAMP NULL DEFAULT NULL,
          hod_comment VARCHAR(500) DEFAULT NULL,
          reviewed_by INT DEFAULT NULL,
          reviewed_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_apa_dept (department_id),
          KEY idx_apa_user (user_id),
          KEY idx_apa_fy (financial_year_key),
          KEY idx_apa_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created academic_programme_allocations');
    } else {
      console.log('  skip (exists): academic_programme_allocations');
    }

    await migrateReviewColumns(connection);

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
