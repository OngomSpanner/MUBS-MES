/**
 * Replace all departments in the database with the correct data
 * from public/tableConvert.com_irmf5d.json
 * 
 * Handles duplicate department names by making external_name unique
 * using "DEPT_NAME::PARENT_NAME" format for children.
 * 
 * Usage: node scripts/replace_departments.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Basic dotenv parser for .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      line = line.replace('\r', '').trim();
      if (!line || line.startsWith('#')) return;
      const index = line.indexOf('=');
      if (index > 0) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        process.env[key] = value;
      }
    });
  }
}

function generateCode() {
  return 'D' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

async function main() {
  loadEnv();

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const conn = await pool.getConnection();

  try {
    // Read and Deduplicate JSON data
    const jsonPath = path.resolve(__dirname, '../public/tableConvert.com_irmf5d.json');
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Deduplicate by Dept and Parent Dept
    const seenEntries = new Set();
    const data = [];
    for (const row of rawData) {
      const key = `${row.Dept.trim()}||${row['Parent Dept'].trim()}`;
      if (!seenEntries.has(key)) {
        seenEntries.add(key);
        data.push({ dept: row.Dept.trim(), parentDept: row['Parent Dept'].trim() });
      }
    }

    console.log(`Read ${rawData.length} rows, reduced to ${data.length} unique entries.`);

    // 1. Collect all unique parent names and insert them as root units
    const parentNames = new Set(data.map(d => d.parentDept));
    console.log(`\nInserting ${parentNames.size} parent offices/faculties...`);
    
    await conn.execute('SET FOREIGN_KEY_CHECKS=0');
    await conn.execute('DELETE FROM departments');
    await conn.execute('DELETE FROM strategic_activity_departments');
    await conn.execute('ALTER TABLE departments AUTO_INCREMENT = 1');
    await conn.execute('SET FOREIGN_KEY_CHECKS=1');

    const parentIdMap = new Map(); // parentName -> id
    for (const parentName of parentNames) {
      const code = generateCode();
      const type = parentName.includes('FACULTY') || parentName.includes('SCHOOL') ? 'faculty' : 'office';
      const [result] = await conn.execute(
        `INSERT INTO departments (name, code, unit_type, parent_id, hod_id, is_active, description, created_at, external_name) 
         VALUES (?, ?, ?, NULL, NULL, 1, NULL, CURRENT_TIMESTAMP, ?)`,
        [parentName, code, type, parentName]
      );
      parentIdMap.set(parentName, result.insertId);
    }

    // 2. Insert every entry as a "Department" regardless of if it matches parent
    // This provides "both levels of access" for self-parented units.
    console.log('\nInserting department/unit entries...');
    let successCount = 0;
    const externalNameCounts = new Map();

    for (const entry of data) {
      const parentId = parentIdMap.get(entry.parentDept);
      const code = generateCode();
      
      // Ensure unique external name - if it matches parent, append (Dept)
      let externalName = entry.dept === entry.parentDept ? `${entry.dept} (Dept)` : `${entry.dept} (${entry.parentDept})`;
      
      const count = (externalNameCounts.get(externalName) || 0) + 1;
      externalNameCounts.set(externalName, count);
      if (count > 1) {
        externalName = `${externalName} #${count}`;
      }

      await conn.execute(
        `INSERT INTO departments (name, code, unit_type, parent_id, hod_id, is_active, description, created_at, external_name) 
         VALUES (?, ?, ?, ?, NULL, 1, NULL, CURRENT_TIMESTAMP, ?)`,
        [entry.dept, code, 'department', parentId, externalName]
      );
      successCount++;
    }

    // 3. Clear user department references since IDs changed
    await conn.execute(`UPDATE users SET department_id = NULL WHERE department_id IS NOT NULL`);
    console.log(`\nCleared ${nullResult.affectedRows} user department references`);

    await conn.commit();

    // Print summary
    const [deptCount] = await conn.execute('SELECT COUNT(*) as cnt FROM departments');
    const [parentCount] = await conn.execute('SELECT COUNT(*) as cnt FROM departments WHERE parent_id IS NULL');
    const [childCountResult] = await conn.execute('SELECT COUNT(*) as cnt FROM departments WHERE parent_id IS NOT NULL');

    console.log('\n=== Summary ===');
    console.log(`Total departments: ${deptCount[0].cnt}`);
    console.log(`  Top-level (offices/faculties): ${parentCount[0].cnt}`);
    console.log(`  Child (departments): ${childCountResult[0].cnt}`);

    // Show the tree
    console.log('\n=== Department Tree ===');
    const [allDepts] = await conn.execute('SELECT id, name, parent_id, external_name FROM departments ORDER BY parent_id IS NULL DESC, name');
    const byParent = {};
    for (const d of allDepts) {
      const pid = d.parent_id || 'root';
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(d);
    }
    for (const root of (byParent['root'] || [])) {
      console.log(`📁 ${root.name} (id=${root.id})`);
      for (const child of (byParent[root.id] || [])) {
        console.log(`   └─ ${child.name} (id=${child.id})`);
      }
    }

    console.log('\nDone!');

  } catch (err) {
    await conn.rollback();
    console.error('Error:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
