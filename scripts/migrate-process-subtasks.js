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
    console.log('Creating staff_process_subtasks table (if missing)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff_process_subtasks (
        id INT NOT NULL AUTO_INCREMENT,
        process_assignment_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        assigned_to INT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY process_assignment_id (process_assignment_id),
        KEY assigned_to (assigned_to),
        KEY status (status)
      ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();

