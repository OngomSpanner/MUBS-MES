const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Adding process_subtask_id column to staff_reports (if missing)...');
    try {
      await connection.execute(
        'ALTER TABLE staff_reports ADD COLUMN process_subtask_id INT NULL AFTER process_assignment_id'
      );
    } catch (e) {
      if (e && e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column already exists.');
      } else {
        throw e;
      }
    }

    console.log('Adding index for process_subtask_id...');
    try {
      await connection.execute('ALTER TABLE staff_reports ADD KEY process_subtask_id (process_subtask_id)');
    } catch (e) {
      // ignore if already exists
    }

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();

