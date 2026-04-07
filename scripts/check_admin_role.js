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
    const [rows] = await pool.execute('SELECT role FROM users WHERE email="admin@mubs.ac.ug"');
    console.log('User role in DB:', rows[0]?.role);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

go();
