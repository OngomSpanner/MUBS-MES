/**
 * Scope workforce & skills reports per ambassador faculty/office.
 * Run: node scripts/migrate-ambassador-report-scope.js
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

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].c > 0;
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    console.log('Ambassador report scope…');

    if (!(await columnExists(connection, 'staff_workforce_assessment_counts', 'managed_unit_id'))) {
      await connection.execute(`
        ALTER TABLE staff_workforce_assessment_counts
        ADD COLUMN managed_unit_id INT NULL AFTER id,
        ADD KEY idx_workforce_managed_unit (managed_unit_id)
      `);
      console.log('  added managed_unit_id to staff_workforce_assessment_counts');
    }

    if (await indexExists(connection, 'staff_workforce_assessment_counts', 'uq_workforce_assessment')) {
      await connection.execute(`
        ALTER TABLE staff_workforce_assessment_counts
        DROP INDEX uq_workforce_assessment
      `);
      console.log('  dropped old uq_workforce_assessment');
    }

    if (!(await indexExists(connection, 'staff_workforce_assessment_counts', 'uq_workforce_assessment_unit'))) {
      await connection.execute(`
        ALTER TABLE staff_workforce_assessment_counts
        ADD UNIQUE KEY uq_workforce_assessment_unit (managed_unit_id, assessment_detail, financial_year_key)
      `);
      console.log('  added uq_workforce_assessment_unit');
    }

    if (!(await columnExists(connection, 'staff_employment_skill_status', 'managed_unit_id'))) {
      await connection.execute(`
        ALTER TABLE staff_employment_skill_status
        ADD COLUMN managed_unit_id INT NULL AFTER id,
        ADD KEY idx_employment_skill_managed_unit (managed_unit_id)
      `);
      console.log('  added managed_unit_id to staff_employment_skill_status');
    }

    if (await indexExists(connection, 'staff_employment_skill_status', 'uq_employment_skill_year')) {
      await connection.execute(`
        ALTER TABLE staff_employment_skill_status
        DROP INDEX uq_employment_skill_year
      `);
      console.log('  dropped old uq_employment_skill_year');
    }

    if (!(await indexExists(connection, 'staff_employment_skill_status', 'uq_employment_skill_unit_year'))) {
      await connection.execute(`
        ALTER TABLE staff_employment_skill_status
        ADD UNIQUE KEY uq_employment_skill_unit_year (managed_unit_id, financial_year_key)
      `);
      console.log('  added uq_employment_skill_unit_year');
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
