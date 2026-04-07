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

  try {
    console.log('--- Table Schema Detail ---');
    const [columns] = await pool.execute('DESCRIBE departments');
    console.log(JSON.stringify(columns, null, 2));

    console.log('\n--- Triggers on departments ---');
    const [triggers] = await pool.execute('SHOW TRIGGERS LIKE "departments"');
    console.log(JSON.stringify(triggers, null, 2));

    console.log('\n--- Searching for the specific department ---');
    const [rows] = await pool.execute('SELECT * FROM departments WHERE name LIKE ?', ['%ACCOUNTING AND FINANCE%MBARARA%']);
    console.log(JSON.stringify(rows, null, 2));

    if (rows.length > 0) {
        const parentId = rows[0].parent_id;
        if (parentId) {
            console.log('\n--- Parent Details ---');
            const [prows] = await pool.execute('SELECT * FROM departments WHERE id = ?', [parentId]);
            console.log(JSON.stringify(prows, null, 2));
        }
    }

  } catch (err) {
    console.error('Error during research:', err);
  } finally {
    await pool.end();
  }
}

go();
