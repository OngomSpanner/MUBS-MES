/**
 * MUBS official programme catalogue.
 * Run: node scripts/migrate-mubs-programmes.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const CATALOGUE = [
  { name: 'CERTIFICATE IN ENTREPRENEURSHIP & SMALL BUSINESS', level: 'Certificate' },
  { name: 'NATIONAL CERTIFICATE IN BUSINESS ADMINISTRATION', level: 'National Certificate' },
  { name: 'HIGHER EDUCATION CERTIFICATE IN BUSINESS STUDIES', level: 'Higher Education Certificate' },
  { name: 'DIPLOMA IN PROCUREMENT AND LOGISTICS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN HUMAN RESOURCE MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN HOTEL AND RESTAURANT BUSINESS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN COMPUTER SCIENCE', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS COMPUTING', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS ADMINISTRATION', level: 'Diploma' },
  { name: 'DIPLOMA IN ACCOUNTING & FINANCE', level: 'Diploma' },
  { name: 'DIPLOMA IN CATERING AND HOTEL OPERATIONS', level: 'Diploma' },
  { name: 'DIPLOMA IN PROCUREMENT AND SUPPLY CHAIN MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS INTELLIGENCE AND DATA ANALYTICS', level: 'Diploma' },
  { name: 'BACHELOR OF TRAVEL AND TOURISM MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF INTERNATIONAL BUSINESS', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS COMPUTING', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS STATISTICS', level: 'Bachelor' },
  { name: 'BACHELOR OF CATERING AND HOTEL MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF COMMERCE', level: 'Bachelor' },
  { name: 'BACHELOR OF ENTREPRENEURSHIP', level: 'Bachelor' },
  { name: 'BACHELOR OF HUMAN RESOURCE MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF LEADERSHIP AND GOVERNANCE', level: 'Bachelor' },
  { name: 'BACHELOR OF TRANSPORT AND LOGISTICS MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF LEISURE AND HOSPITALITY MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF OFFICE AND INFORMATION MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF PROCUREMENT AND SUPPLY CHAIN MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF REAL ESTATE MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN ACCOUNTING', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN FINANCE', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN MARKETING', level: 'Bachelor' },
  { name: 'BACHELOR OF ARTS IN ECONOMICS', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS ADMINISTRATION', level: 'Bachelor' },
  { name: 'BACHELOR OF LEISURE EVENTS & HOTEL MANAGEMENT', level: 'Bachelor' },
  { name: 'POSTGRADUATE DIPLOMA OF BUSINESS ADMINISTRATION', level: 'Postgraduate Diploma' },
  { name: 'POST GRADUATE DIPLOMA IN BUSINESS EDUCATION', level: 'Postgraduate Diploma' },
  {
    name: 'POSTGRADUATE DIPLOMA IN BUSINESS INTELLIGENCE AND DATA ANALYTICS (PBDA)',
    level: 'Postgraduate Diploma',
  },
  { name: 'POST GRADUATE DIPLOMA IN PUBLIC ADMINISTRATION', level: 'Postgraduate Diploma' },
  { name: 'DOCTOR OF ENERGY ECONOMICS AND GOVERNANCE', level: 'Doctorate' },
  { name: 'DOCTOR OF BUSINESS ADMINISTRATION', level: 'Doctorate' },
  { name: 'DOCTOR OF PHILOSOPHY', level: 'Doctorate' },
];

const LEVEL_SORT = {
  Certificate: 1,
  'National Certificate': 2,
  'Higher Education Certificate': 3,
  Diploma: 4,
  Bachelor: 5,
  'Postgraduate Diploma': 6,
  Doctorate: 7,
};

function sortOrder(level, index) {
  return (LEVEL_SORT[level] ?? 99) * 1000 + index;
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
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
    console.log('MUBS programme catalogue…');

    if (!(await tableExists(connection, 'mubs_programmes'))) {
      await connection.execute(`
        CREATE TABLE mubs_programmes (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          level VARCHAR(64) NOT NULL,
          sort_order INT UNSIGNED NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_mubs_programme_name (name),
          KEY idx_mubs_programme_level (level),
          KEY idx_mubs_programme_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created mubs_programmes');
    } else {
      console.log('  skip (exists): mubs_programmes');
    }

    let inserted = 0;
    let updated = 0;

    const oldTypoName = 'DIPLOMA IN PROCUREMENT AND SUPLLY CHAIN MANAGEMENT';
    const correctedName = 'DIPLOMA IN PROCUREMENT AND SUPPLY CHAIN MANAGEMENT';
    if (await tableExists(connection, 'mubs_programmes')) {
      const [fixResult] = await connection.execute(
        `UPDATE mubs_programmes SET name = ? WHERE name = ?`,
        [correctedName, oldTypoName]
      );
      if (fixResult.affectedRows > 0) {
        console.log('  corrected programme name typo (SUPLLY → SUPPLY)');
      }
    }

    for (const table of [
      'academic_programme_allocations',
      'academic_course_unit_assignments',
      'staff_programme_enrollment',
    ]) {
      if (!(await tableExists(connection, table))) continue;
      const [r] = await connection.execute(
        `UPDATE ${table} SET programme_name = ? WHERE programme_name = ?`,
        [correctedName, oldTypoName]
      );
      if (r.affectedRows > 0) {
        console.log(`  updated ${r.affectedRows} row(s) in ${table}`);
      }
    }

    for (let i = 0; i < CATALOGUE.length; i++) {
      const { name, level } = CATALOGUE[i];
      const order = sortOrder(level, i + 1);
      const [result] = await connection.execute(
        `
          INSERT INTO mubs_programmes (name, level, sort_order, is_active)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            level = VALUES(level),
            sort_order = VALUES(sort_order),
            is_active = 1
        `,
        [name, level, order]
      );
      if (result.affectedRows === 1) inserted += 1;
      else if (result.affectedRows === 2) updated += 1;
    }

    console.log(`  seeded ${CATALOGUE.length} programmes (${inserted} new, ${updated} updated)`);
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
