const mysql = require('mysql2/promise');

async function updateNullDates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    await connection.query("UPDATE strategic_activities SET start_date = '2025-07-01', end_date = '2030-06-30' WHERE start_date IS NULL OR end_date IS NULL");
    console.log("Updated missing activity dates to Uganda 2025-2030 FY span.");
  } catch(e) { console.log(e.message); }

  connection.end();
}
updateNullDates();
