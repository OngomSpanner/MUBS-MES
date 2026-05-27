/**
 * Annual employment & skill status reports per FY.
 * Run: node scripts/migrate-staff-employment-skill-status.js
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
    console.log('Employment & skill status tables…');

    if (!(await tableExists(connection, 'staff_employment_skill_status'))) {
      await connection.execute(`
        CREATE TABLE staff_employment_skill_status (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          financial_year_key VARCHAR(16) NOT NULL,
          reports_produced INT NOT NULL DEFAULT 0,
          skills_missing INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_employment_skill_year (financial_year_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_employment_skill_status');
    } else {
      console.log('  skip (exists): staff_employment_skill_status');
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
