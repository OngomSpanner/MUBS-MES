/**
 * Staff benefits: per-staff FY benefit receipt.
 * Run: node scripts/migrate-staff-benefits.js
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
    console.log('Staff benefit tables…');

    if (!(await tableExists(connection, 'staff_benefit_entries'))) {
      await connection.execute(`
        CREATE TABLE staff_benefit_entries (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_benefit_entries');
    } else {
      console.log('  skip (exists): staff_benefit_entries');
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
