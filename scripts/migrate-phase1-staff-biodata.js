/**
 * Phase 1: add structured staff biodata columns to users + expand employment/leave enums.
 * Run: node scripts/migrate-phase1-staff-biodata.js
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
    console.log('Phase 1 staff biodata migration…');

    console.log('Adding biodata columns to users…');
    await addColumnIfMissing(connection, 'users', 'gender', "ENUM('Male','Female','Other','Prefer not to say') DEFAULT NULL");
    await addColumnIfMissing(connection, 'users', 'nationality', 'VARCHAR(100) DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'date_of_birth', 'DATE DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'date_first_appointment', 'DATE DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'date_current_appointment', 'DATE DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'date_office_assignment', 'DATE DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'retirement_date', 'DATE DEFAULT NULL');
    await addColumnIfMissing(connection, 'users', 'designation_grade', 'VARCHAR(100) DEFAULT NULL');

    console.log('Expanding employment_status enum…');
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN employment_status
        ENUM(
          'active','on_leave','expired','terminated',
          'retired','resigned','dismissed','deceased',
          'study_leave','sabbatical'
        ) DEFAULT 'active'
    `);

    console.log('Expanding leave_status enum…');
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN leave_status
        ENUM(
          'On Duty','On Leave','Sick Leave','Annual Leave',
          'Study Leave','Sabbatical Leave'
        ) DEFAULT 'On Duty'
    `);

    console.log('Backfilling duplicate contract date columns…');
    await connection.execute(`
      UPDATE users
      SET contract_start_date = contract_start
      WHERE contract_start_date IS NULL AND contract_start IS NOT NULL
    `);
    await connection.execute(`
      UPDATE users
      SET contract_end_date = contract_end
      WHERE contract_end_date IS NULL AND contract_end IS NOT NULL
    `);
    await connection.execute(`
      UPDATE users
      SET contract_start = contract_start_date
      WHERE contract_start IS NULL AND contract_start_date IS NOT NULL
    `);
    await connection.execute(`
      UPDATE users
      SET contract_end = contract_end_date
      WHERE contract_end IS NULL AND contract_end_date IS NOT NULL
    `);

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
