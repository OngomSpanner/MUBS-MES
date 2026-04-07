const mysql = require('mysql2/promise');

async function migrateTargetCols() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    await connection.query('ALTER TABLE strategic_activities DROP COLUMN target_fy25_26');
    await connection.query('ALTER TABLE strategic_activities DROP COLUMN target_fy26_27');
    await connection.query('ALTER TABLE strategic_activities DROP COLUMN target_fy27_28');
    await connection.query('ALTER TABLE strategic_activities DROP COLUMN target_fy28_29');
    await connection.query('ALTER TABLE strategic_activities DROP COLUMN target_fy29_30');
    console.log("Dropped 5 FY target columns");
  } catch(e) { console.log(e.message); }

  connection.end();
}
migrateTargetCols();
