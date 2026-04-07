const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });

  try {
    console.log('Adding process_assignment_id to staff_reports...');
    await connection.execute('ALTER TABLE staff_reports ADD COLUMN process_assignment_id INT NULL AFTER activity_assignment_id');
    console.log('Adding foreign key...');
    await connection.execute('ALTER TABLE staff_reports ADD FOREIGN KEY (process_assignment_id) REFERENCES staff_process_assignments(id)');
    console.log('Migration successful!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('Column already exists.');
    } else {
        console.error('Error during migration:', error);
    }
  } finally {
    await connection.end();
  }
}

migrate();
