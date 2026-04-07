const mysql = require('mysql2/promise');

async function fixPillarColumn() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    // Change pillar to VARCHAR to support the longer new MUBS pillar titles without breaking enum rules
    await connection.query("ALTER TABLE strategic_activities MODIFY COLUMN pillar VARCHAR(255)");
    console.log("Successfully changed strategic_activities.pillar to VARCHAR(255)");
  } catch(e) { console.log("Error:", e.message); }

  try {
    // Also do the same for 'standards' table if it has a pillar column, though I think it doesn't
  } catch(e) {}

  connection.end();
}
fixPillarColumn();
