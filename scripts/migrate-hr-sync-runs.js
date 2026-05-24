/**
 * Log table for HR sync runs (monthly auto + manual).
 * Run: node scripts/migrate-hr-sync-runs.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hr_sync_runs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        run_type VARCHAR(32) NOT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        updated_count INT DEFAULT 0,
        skipped_not_in_hr INT DEFAULT 0,
        error_count INT DEFAULT 0
      )
    `);
    console.log('hr_sync_runs table ready.');
  } finally {
    await connection.end();
  }
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
