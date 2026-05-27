/**
 * Staff to student ratio — teaching staff (lecturers) listing per programme/course unit.
 * Lecturer here means teaching staff, not the job title.
 *
 * Run: node scripts/migrate-staff-student-ratio.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

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
    console.log('Staff-student ratio tables…');

    if (!(await tableExists(connection, 'staff_student_ratio_entries'))) {
      await connection.execute(`
        CREATE TABLE staff_student_ratio_entries (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          faculty_name VARCHAR(255) DEFAULT NULL,
          department_name VARCHAR(255) DEFAULT NULL,
          programme_name VARCHAR(255) DEFAULT NULL,
          course_unit_name VARCHAR(255) DEFAULT NULL,
          qualification VARCHAR(255) DEFAULT NULL,
          qualification_details VARCHAR(500) DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ssr_user (user_id),
          KEY idx_ssr_faculty (faculty_name),
          KEY idx_ssr_department (department_name),
          KEY idx_ssr_programme (programme_name),
          KEY idx_ssr_course_unit (course_unit_name),
          CONSTRAINT fk_ssr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('  created staff_student_ratio_entries');
    } else {
      console.log('  skip (exists): staff_student_ratio_entries');
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

