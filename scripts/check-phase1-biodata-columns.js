require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const COLUMNS = [
  'gender',
  'nationality',
  'date_of_birth',
  'date_first_appointment',
  'date_current_appointment',
  'date_office_assignment',
  'retirement_date',
  'designation_grade',
  'employment_status',
  'leave_status',
];

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN (${COLUMNS.map(() => '?').join(',')})
     ORDER BY COLUMN_NAME`,
    COLUMNS
  );

  console.log('Database:', process.env.DB_NAME);
  console.log('Phase 1 biodata columns on users:');
  for (const col of COLUMNS) {
    const found = rows.find((r) => r.COLUMN_NAME === col);
    console.log(found ? `  [OK] ${col} — ${found.COLUMN_TYPE}` : `  [MISSING] ${col}`);
  }

  await connection.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
