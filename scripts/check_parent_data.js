const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      line = line.replace('\r', '').trim();
      if (!line || line.startsWith('#')) return;
      const i = line.indexOf('=');
      if (i > 0) process.env[line.substring(0, i).trim()] = line.substring(i + 1).trim();
    });
  }
}

async function go() {
  loadEnv();
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin'
  });

  const [rows] = await pool.execute(`
    SELECT d.id, d.name, d.parent_id, p.name as parent_name 
    FROM departments d 
    LEFT JOIN departments p ON d.parent_id = p.id 
    WHERE d.parent_id IS NOT NULL 
    LIMIT 20
  `);
  
  console.log('Sample of child departments with parent names:');
  console.log(JSON.stringify(rows, null, 2));
  
  const [counts] = await pool.execute('SELECT COUNT(*) as total, SUM(CASE WHEN parent_id IS NOT NULL AND (SELECT name FROM departments WHERE id = d.parent_id) IS NULL THEN 1 ELSE 0 END) as orphan_count FROM departments d');
  console.log('\nStats:', counts[0]);
  
  await pool.end();
}

go();
