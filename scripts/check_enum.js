const mysql = require('mysql2/promise');

async function checkEnum() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM strategic_activities LIKE 'pillar'");
    console.log(rows[0].Type);
  } catch(e) { console.log(e.message); }

  connection.end();
}
checkEnum();
