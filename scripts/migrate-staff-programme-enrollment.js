/**
 * Student enrollment counts per programme (M&E).
 * Run: node scripts/migrate-staff-programme-enrollment.js
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
    console.log('Programme student enrollment table…');

    if (!(await tableExists(connection, 'staff_programme_enrollment'))) {
      await connection.execute(`
        CREATE TABLE staff_programme_enrollment (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_programme_enrollment');
    } else {
      console.log('  skip (exists): staff_programme_enrollment');
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
