import mysql from 'mysql2/promise';

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });

  try {
    const [deptRows] = await pool.query("SHOW CREATE TABLE departments");
    console.log('--- departments ---');
    console.log(deptRows[0]['Create Table']);

    const [unitRows] = await pool.query("SHOW CREATE TABLE units");
    console.log('--- units ---');
    console.log(unitRows[0]['Create Table']);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
