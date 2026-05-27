/**
 * Staff assignments to strategic priority areas per FY (for % reports).
 * Run: node scripts/migrate-staff-strategic-priority.js
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
    console.log('Staff strategic priority tables…');

    if (!(await tableExists(connection, 'staff_strategic_priority_assignments'))) {
      await connection.execute(`
        CREATE TABLE staff_strategic_priority_assignments (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          strategic_pillar VARCHAR(255) NOT NULL,
          financial_year_key VARCHAR(16) NOT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_staff_priority_user_year (user_id, financial_year_key),
          KEY idx_staff_priority_pillar (strategic_pillar),
          KEY idx_staff_priority_year (financial_year_key),
          CONSTRAINT fk_staff_priority_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_strategic_priority_assignments');
    } else {
      console.log('  skip (exists): staff_strategic_priority_assignments');
    }

    if (!(await tableExists(connection, 'staff_strategic_priority_pct'))) {
      await connection.execute(`
        CREATE TABLE staff_strategic_priority_pct (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          strategic_pillar VARCHAR(255) NOT NULL,
          financial_year_key VARCHAR(16) NOT NULL,
          gender_pct DECIMAL(6,2) DEFAULT NULL,
          pwd_pct DECIMAL(6,2) DEFAULT NULL,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_staff_priority_pct (strategic_pillar, financial_year_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_strategic_priority_pct');
    } else {
      console.log('  skip (exists): staff_strategic_priority_pct');
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
