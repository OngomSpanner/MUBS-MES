const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

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

// Role Normalizer
function normalizeRole(roleStr) {
  if (!roleStr) return 'staff';
  const r = roleStr.toLowerCase().trim();
  if (r.includes('sys') || r.includes('admin')) return 'system_admin';
  if (r.includes('strat')) return 'strategy_manager';
  if (r.includes('hod') || r.includes('head') || r.includes('princip')) return 'unit_head';
  if (r.includes('comm') || r.includes('member')) return 'committee_member';
  if (r.includes('ambas')) return 'ambassador';
  return 'staff';
}

// Date Parser: Handles "1 Jan 2026", "2026-01-01", or Excel serial numbers
function parseDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  } catch (e) {
    return null;
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

  const connection = await pool.getConnection();

  try {
    const filename = process.argv[2] || 'staff_import.csv';
    const filePath = path.resolve(__dirname, '..', filename);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File ${filename} not found in project root.`);
      process.exit(1);
    }

    console.log(`Reading file: ${filename}`);
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${data.length} rows to process.`);

    const defaultPass = 'password';
    const passwordHash = await bcrypt.hash(defaultPass, 10);
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of data) {
      const email = (row['Email'] || row['email'])?.toString().trim();
      const firstName = (row['First Name'] || row['first_name'])?.toString().trim();
      const surname = (row['Surname'] || row['surname'])?.toString().trim();
      const otherNames = (row['Othernames'] || row['Other Names'] || row['other_names'] || '').toString().trim();
      const deptId = Number(row['Department ID'] || row['department_id']);
      const empId = (row['Employee ID'] || row['employee_id'] || '').toString().trim() || null;
      const position = (row['Position'] || row['position'] || '').toString().trim() || null;
      const start = parseDate(row['Contract Starts'] || row['contract_start']);
      const end = parseDate(row['Contract Ends'] || row['contract_end']);
      
      const category = (row['Staff Category'] || row['staff_category'] || 'Administrative').toString().trim();
      const terms = (row['Contract Terms'] || row['contract_terms'] || 'Permanent').toString().trim();
      const type = (row['Contract Type'] || row['contract_type'] || 'Full-time').toString().trim();
      const rawRoles = (row['Role'] || row['role'] || 'staff').toString().split(',');
      const status = (row['Account Status'] || row['status'] || 'Active').toString().trim();

      if (!email || !firstName || !surname || isNaN(deptId)) {
        skippedCount++;
        continue;
      }

      try {
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
          await connection.rollback();
          skippedCount++;
          continue;
        }

        const fullName = `${firstName} ${surname} ${otherNames}`.trim();
        const normalizedRoles = Array.from(new Set(rawRoles.map(r => normalizeRole(r))));
        const rolesString = normalizedRoles.join(',');

        const [uResult] = await connection.execute(
          `INSERT INTO users (
            email, password_hash, first_name, surname, other_names, full_name, 
            department_id, employee_id, position, contract_start, contract_end,
            staff_category, contract_terms, contract_type, role, status, 
            must_change_password, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            email, passwordHash, firstName, surname, otherNames, fullName, 
            deptId, empId, position, start, end,
            category, terms, type, rolesString, status
          ]
        );

        const newUserId = uResult.insertId;

        for (const role of normalizedRoles) {
          await connection.execute(
            'INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, NOW())',
            [newUserId, role]
          );
        }

        await connection.commit();
        successCount++;
        if (successCount % 100 === 0) console.log(`Processed ${successCount} users...`);

      } catch (rowErr) {
        await connection.rollback();
        console.error(`[ERROR] Failed to import ${email}:`, rowErr.message);
        errorCount++;
      }
    }

    console.log('\n--- Final Summary ---');
    console.log(`Successfully Imported: ${successCount}`);
    console.log(`Skipped (Duplicate/Missing): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total records processed: ${data.length}`);

  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    connection.release();
    await pool.end();
  }
}

go();
