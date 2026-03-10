import mysql from 'mysql2/promise';

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });

  const [rows] = await pool.query("SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'strategic_activities' AND CONSTRAINT_NAME != 'PRIMARY'");
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
