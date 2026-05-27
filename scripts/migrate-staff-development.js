/**
 * Staff development: per-staff AY entries + training implementation summary.
 * Run: node scripts/migrate-staff-development.js
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
    console.log('Staff development tables…');

    if (!(await tableExists(connection, 'staff_development_entries'))) {
      await connection.execute(`
        CREATE TABLE staff_development_entries (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          academic_year_key VARCHAR(16) NOT NULL,
          education_level VARCHAR(120) DEFAULT NULL,
          programme VARCHAR(255) DEFAULT NULL,
          training_status ENUM('completed', 'ongoing') DEFAULT NULL,
          is_recommended TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_staff_dev_user_year (user_id, academic_year_key),
          KEY idx_staff_dev_year (academic_year_key),
          CONSTRAINT fk_staff_dev_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_development_entries');
    } else {
      console.log('  skip (exists): staff_development_entries');
    }

    if (await tableExists(connection, 'staff_development_entries')) {
      const [devCols] = await connection.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_development_entries'
           AND COLUMN_NAME = 'training_status'`
      );
      if (devCols[0].c === 0) {
        await connection.execute(`
          ALTER TABLE staff_development_entries
          ADD COLUMN training_status ENUM('completed', 'ongoing') DEFAULT NULL
          AFTER programme
        `);
        console.log('  added staff_development_entries.training_status');
      }
    }

    if (!(await tableExists(connection, 'staff_training_implementation'))) {
      await connection.execute(`
        CREATE TABLE staff_training_implementation (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          academic_year_key VARCHAR(16) NOT NULL,
          completed_count INT NOT NULL DEFAULT 0,
          ongoing_count INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_training_impl_year (academic_year_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_training_implementation');
    } else {
      console.log('  skip (exists): staff_training_implementation');
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
