/**
 * Roll back Phase 3: drop staff development / training tables.
 * Run: node scripts/rollback-phase3-staff-training.js
 *
 * Does not revert users.leave_status / employment_status changed by approved training.
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

async function rollback() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('Phase 3 rollback: staff development tables…');

    if (await tableExists(connection, 'staff_training_applications')) {
      await connection.execute('DROP TABLE staff_training_applications');
      console.log('  dropped staff_training_applications');
    } else {
      console.log('  skip (missing): staff_training_applications');
    }

    if (await tableExists(connection, 'staff_development_windows')) {
      await connection.execute('DROP TABLE staff_development_windows');
      console.log('  dropped staff_development_windows');
    } else {
      console.log('  skip (missing): staff_development_windows');
    }

    console.log('Done.');
  } catch (err) {
    console.error('Rollback failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

rollback();
