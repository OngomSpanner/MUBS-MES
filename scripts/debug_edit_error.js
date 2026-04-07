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

  const queryStr = 'SELECT * FROM departments WHERE name LIKE ?';
  const [rows] = await pool.execute(queryStr, ['%ACCOUNTING AND FINANCE-MBARARA%']);
  
  if (rows.length === 0) {
    console.log('No department found with that name.');
    await pool.end();
    return;
  }
  
  const dept = rows[0];
  console.log('Existing data:', dept);
  
  try {
    // Attempt the same UPDATE that the API would do
    // body: { name, code, unit_type, parent_id, description, is_active }
    const payload = {
        name: dept.name,
        code: dept.code,
        unit_type: dept.unit_type,
        parent_id: dept.parent_id,
        description: dept.description,
        is_active: dept.is_active,
        id: dept.id
    };
    
    console.log('\nAttempting update with payload:', payload);
    
    await pool.execute(
        `UPDATE departments 
         SET name = ?, code = ?, unit_type = ?, parent_id = ?, description = ?, is_active = ?
         WHERE id = ?`,
        [payload.name, payload.code, payload.unit_type, payload.parent_id, payload.description, payload.is_active, payload.id]
    );
    
    console.log('Update Successful!');
  } catch (err) {
    console.error('\nUpdate Failed with Error:');
    console.error(err.message);
    if (err.code) console.error('Error Code:', err.code);
  } finally {
    await pool.end();
  }
}

go();
