/**
 * Workforce assessments: counts per assessment detail and FY.
 * Run: node scripts/migrate-staff-workforce-assessments.js
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

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('Workforce assessment tables…');

    if (!(await tableExists(connection, 'staff_workforce_assessment_counts'))) {
      await connection.execute(`
        CREATE TABLE staff_workforce_assessment_counts (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          assessment_detail VARCHAR(255) NOT NULL,
          financial_year_key VARCHAR(16) NOT NULL,
          count_value INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_workforce_assessment (assessment_detail, financial_year_key),
          KEY idx_workforce_assessment_year (financial_year_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_workforce_assessment_counts');
    } else {
      console.log('  skip (exists): staff_workforce_assessment_counts');
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
