const mysql = require('mysql2/promise');

async function analyzeDB() {
  const connection = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'mubs_super_admin'
  });
  
  const out = [];
  
  const [tables] = await connection.query("SHOW TABLES");
  out.push("ALL TABLES:");
  tables.forEach(t => out.push('  ' + Object.values(t)[0]));

  for (const table of ['strategic_activities','standards','standard_processes','departments','users','staff_process_assignments','activity_assignments']) {
    try {
      const [cols] = await connection.query(`DESCRIBE ${table}`);
      out.push(`\n${table}:`);
      cols.forEach(c => out.push(`  ${c.Field} | ${c.Type} | NULL:${c.Null} | Key:${c.Key}`));
    } catch(e) { out.push(`\n${table}: NOT FOUND`); }
  }

  connection.end();
  return out.join('\n');
}

analyzeDB().then(r => process.stdout.write(r + '\n'));
