/**
 * Staff payments: per-staff FY payment participation.
 * Run: node scripts/migrate-staff-payments.js
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
    console.log('Staff payment tables…');

    if (!(await tableExists(connection, 'staff_payment_entries'))) {
      await connection.execute(`
        CREATE TABLE staff_payment_entries (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_payment_entries');
    } else {
      console.log('  skip (exists): staff_payment_entries');
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

