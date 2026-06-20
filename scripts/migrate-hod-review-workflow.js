/**
 * HOD approval workflow for ambassador reporting data.
 * Run: node scripts/migrate-hod-review-workflow.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].c > 0;
}

async function addReviewColumns(connection, table) {
  if (!(await tableExists(connection, table))) {
    console.log(`  skip (no table): ${table}`);
    return;
  }
  if (await columnExists(connection, table, 'hod_review_status')) {
    console.log(`  skip (exists): ${table}.hod_review_status`);
    return;
  }
  await connection.execute(`
    ALTER TABLE ${table}
    ADD COLUMN hod_review_status ENUM('draft','submitted','approved','returned') NOT NULL DEFAULT 'approved',
    ADD COLUMN hod_reviewed_by INT NULL,
    ADD COLUMN hod_reviewed_at TIMESTAMP NULL,
    ADD COLUMN hod_review_comment TEXT NULL
  `);
  console.log(`  added review columns: ${table}`);
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
  });

  try {
    console.log('HOD review workflow…');
    for (const table of [
      'staff_benefit_entries',
      'staff_workforce_assessment_counts',
      'staff_employment_skill_status',
      'staff_programme_enrollment',
      'staff_course_unit_enrollment',
      'activity_rf_narratives',
    ]) {
      await addReviewColumns(connection, table);
    }

    if (!(await tableExists(connection, 'q_indicator_submissions'))) {
      await connection.execute(`
        CREATE TABLE q_indicator_submissions (
          indicator_id INT NOT NULL,
          department_id INT NOT NULL,
          hod_review_status ENUM('draft','submitted','approved','returned') NOT NULL DEFAULT 'draft',
          submitted_by INT NULL,
          submitted_at TIMESTAMP NULL,
          hod_reviewed_by INT NULL,
          hod_reviewed_at TIMESTAMP NULL,
          hod_review_comment TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (indicator_id, department_id),
          KEY idx_q_ind_sub_status (hod_review_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created q_indicator_submissions');
    } else {
      console.log('  skip (exists): q_indicator_submissions');
    }

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
