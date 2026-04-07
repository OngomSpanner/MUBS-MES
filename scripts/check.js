const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  const [rows] = await connection.query('DESCRIBE strategic_activities');
  console.log(rows);
  connection.end();
}
check();
