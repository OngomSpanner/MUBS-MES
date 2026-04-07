const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const p = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach(l => {
      l = l.replace('\r', '').trim();
      if (!l || l.startsWith('#')) return;
      const i = l.indexOf('=');
      if (i > 0) process.env[l.substring(0, i).trim()] = l.substring(i + 1).trim();
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

  try {
    const [rows] = await pool.execute(`
      SELECT d1.id, d1.name, d2.name as parent_name 
      FROM departments d1 
      LEFT JOIN departments d2 ON d1.parent_id = d2.id 
      ORDER BY d1.name
    `);

    const csvLines = ['ID,Department/Unit Name,Office/Faculty'];
    rows.forEach(r => {
      // Escape quotes for CSV
      const name = (r.name || '').replace(/"/g, '""');
      const parentName = (r.parent_name || r.name || '').replace(/"/g, '""');
      csvLines.push(`"${r.id}","${name}","${parentName}"`);
    });

    const csvContent = csvLines.join('\n');
    fs.writeFileSync(path.resolve(__dirname, '../department_mapping.csv'), csvContent);
    console.log(`Successfully generated department_mapping.csv with ${rows.length} entries.`);
  } catch (err) {
    console.error('Error generating CSV:', err);
  } finally {
    await pool.end();
  }
}

go();
