const mysql = require('mysql2/promise');

async function drop() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    try {
      await connection.query('ALTER TABLE activities DROP FOREIGN KEY activities_ibfk_1');
    } catch(e) {}
    try {
      await connection.query('ALTER TABLE activities DROP FOREIGN KEY activities_objective_id_fk');
    } catch(e) {}

    try {
        await connection.query('ALTER TABLE activities DROP COLUMN objective_id');
        console.log("Successfully dropped 'objective_id' column from activities table.");
    } catch(e) { 
        console.log("Note on objective_id column: " + e.message); 
    }

    try {
        await connection.query('DROP TABLE IF EXISTS objectives');
        console.log("Successfully dropped 'objectives' table.");
    } catch(e) {
        console.log("Note on objectives table: " + e.message); 
    }

  } catch(e) {
    console.error(e);
  } finally {
    connection.end();
  }
}

drop();
