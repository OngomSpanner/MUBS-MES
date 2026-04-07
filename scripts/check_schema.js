const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });

  try {
    const [columns] = await connection.execute('DESCRIBE staff_reports');
    console.log('--- staff_reports columns ---');
    console.log(JSON.stringify(columns, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkSchema();
