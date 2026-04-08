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
    console.log('Altering staff_process_assignments.staff_id to allow NULL (container assignments)...');
    await connection.execute(`
      ALTER TABLE staff_process_assignments
      MODIFY COLUMN staff_id INT NULL
    `);
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();

