/**
 * Phase 2B: Persons with Disabilities (PwD) fields on users.
 * Run: node scripts/migrate-phase2-staff-pwd.js
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
  const exists = await columnExists(connection, table, column);
  if (exists) {
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
    console.log('Phase 2B PwD migration…');
    await addColumnIfMissing(
      connection,
      'users',
      'disability_status',
      "ENUM('Yes','No','Prefer not to say') DEFAULT NULL"
    );
    await addColumnIfMissing(connection, 'users', 'disability_type', 'VARCHAR(150) DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'workplace_accommodation', 'TEXT DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'special_support_needs', 'TEXT DEFAULT NULL');
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
