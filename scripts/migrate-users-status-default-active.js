/**
 * Set users.status default to Active and activate existing Pending accounts.
 * Run: node scripts/migrate-users-status-default-active.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('users.status → default Active…');

    await connection.execute(`
      ALTER TABLE users
        MODIFY COLUMN status ENUM('Active', 'Suspended', 'Pending') NOT NULL DEFAULT 'Active'
    `);
    console.log('  column default set to Active');

    const [result] = await connection.execute(`
      UPDATE users SET status = 'Active' WHERE status = 'Pending'
    `);
    console.log(`  activated ${result.affectedRows ?? 0} Pending account(s)`);

    console.log('Done.');
  } finally {
    await connection.end();
  }
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
