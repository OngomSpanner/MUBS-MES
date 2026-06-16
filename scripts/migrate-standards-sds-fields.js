const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const COLUMNS = [
  { name: 'standard_no', sql: 'VARCHAR(255) NULL' },
  { name: 'user_fee', sql: 'VARCHAR(255) NULL' },
  { name: 'standard_owner', sql: 'VARCHAR(512) NULL' },
  { name: 'supporting_units', sql: 'TEXT NULL' },
  { name: 'pathway', sql: 'TEXT NULL' },
  { name: 'process_standard', sql: 'TEXT NULL' },
  { name: 'time_standard', sql: 'VARCHAR(512) NULL' },
  { name: 'accessibility', sql: 'VARCHAR(512) NULL' },
  { name: 'coverage', sql: 'VARCHAR(512) NULL' },
  { name: 'frequency', sql: 'VARCHAR(512) NULL' },
  { name: 'target_beneficiary', sql: 'TEXT NULL' },
  { name: 'access_criteria', sql: 'TEXT NULL' },
  { name: 'methodology', sql: 'TEXT NULL' },
  { name: 'inputs', sql: 'TEXT NULL' },
  { name: 'performance_indicators', sql: 'JSON NULL' },
];

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
  });

  try {
    console.log('Adding SDS columns to standards (if missing)...');
    for (const col of COLUMNS) {
      try {
        await connection.execute(`ALTER TABLE standards ADD COLUMN ${col.name} ${col.sql}`);
        console.log(`  + ${col.name}`);
      } catch (e) {
        if (e && e.code === 'ER_DUP_FIELDNAME') {
          console.log(`  = ${col.name} (exists)`);
        } else {
          throw e;
        }
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
