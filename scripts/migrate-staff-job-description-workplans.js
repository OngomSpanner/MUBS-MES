/**
 * Staff updated job description + workplans (for % report).
 * Run: node scripts/migrate-staff-job-description-workplans.js
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
    console.log('Staff job description/workplans tables…');

    if (!(await tableExists(connection, 'staff_job_description_workplans_entries'))) {
      await connection.execute(`
        CREATE TABLE staff_job_description_workplans_entries (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_job_description_workplans_entries');
    } else {
      console.log('  skip (exists): staff_job_description_workplans_entries');
    }

    if (!(await tableExists(connection, 'staff_job_description_workplans_pct'))) {
      await connection.execute(`
        CREATE TABLE staff_job_description_workplans_pct (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          financial_year_key VARCHAR(16) NOT NULL,
          pct DECIMAL(6,2) DEFAULT NULL,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_staff_jdwp_pct_year (financial_year_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_job_description_workplans_pct');
    } else {
      console.log('  skip (exists): staff_job_description_workplans_pct');
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

