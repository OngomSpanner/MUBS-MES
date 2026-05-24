/**
 * HRMS sync columns on users.
 * Run: node scripts/migrate-hrms-sync-columns.js
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

async function addColumnIfMissing(connection, table, column, definition) {
  if (await columnExists(connection, table, column)) {
    console.log(`  skip (exists): ${table}.${column}`);
    return;
  }
  await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  added: ${table}.${column}`);
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('HRMS sync columns migration…');
    await addColumnIfMissing(connection, 'users', 'hrms_staff_id', 'INT DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'hrms_last_synced_at', 'DATETIME DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'faculty_office', 'VARCHAR(255) DEFAULT NULL');
    try {
      await connection.execute(
        'CREATE UNIQUE INDEX uniq_users_hrms_staff_id ON users (hrms_staff_id)'
      );
      console.log('  added unique index uniq_users_hrms_staff_id');
    } catch (e) {
      if (String(e.message).includes('Duplicate')) {
        console.log('  skip (exists): uniq_users_hrms_staff_id');
      } else {
        throw e;
      }
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
