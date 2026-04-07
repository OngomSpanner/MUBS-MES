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
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM departments WHERE code IS NULL OR TRIM(code) = ""');
    console.log('Departments with empty/null code:', rows[0].count);
    
    if (rows[0].count > 0) {
        console.log('Fetching examples of departments with empty codes:');
        const [examples] = await pool.execute('SELECT id, name, code FROM departments WHERE code IS NULL OR TRIM(code) = "" LIMIT 5');
        console.log(JSON.stringify(examples, null, 2));
    } else {
        console.log('No empty codes found.');
    }
  } catch (err) {
    console.error('Error during database check:', err);
  } finally {
    await pool.end();
  }
}

go();
