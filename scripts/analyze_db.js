const mysql = require('mysql2/promise');

async function analyzeDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mubs_super_admin'
  });
  
  try {
    // List all tables
    const [tables] = await connection.query("SHOW TABLES");
    console.log("\n=== ALL TABLES ===");
    tables.forEach(t => console.log(Object.values(t)[0]));

    // Describe key tables
    for (const table of ['strategic_activities', 'standards', 'standard_processes', 'departments', 'users']) {
      try {
        const [cols] = await connection.query(`DESCRIBE ${table}`);
        console.log(`\n=== ${table.toUpperCase()} ===`);
        cols.forEach(c => console.log(`  ${c.Field}: ${c.Type} | NULL:${c.Null} | Key:${c.Key} | Default:${c.Default}`));
      } catch(e) { console.log(`  Table ${table} not found`); }
    }

    // Sample data counts
    console.log("\n=== ROW COUNTS ===");
    for (const table of ['strategic_activities', 'standards', 'standard_processes', 'departments']) {
      try {
        const [[{count}]] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${count} rows`);
      } catch(e) {}
    }

  } catch(e) { console.log(e.message); }

  connection.end();
}
analyzeDB();
