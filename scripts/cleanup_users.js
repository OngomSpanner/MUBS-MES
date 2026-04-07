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

  const connection = await pool.getConnection();

  try {
    const adminEmail = 'admin@mubs.ac.ug';
    const [adminRows] = await connection.execute('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (!adminRows.length) {
      console.error(`Error: Admin user with email ${adminEmail} not found. Aborting cleanup.`);
      process.exit(1);
    }

    const adminId = adminRows[0].id;
    console.log(`Verified Admin User: ${adminEmail} (ID: ${adminId})`);

    const [totalUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`Initial User Count: ${totalUsers[0].count}`);

    console.log('\n--- Starting Cleanup Transaction ---');
    await connection.beginTransaction();

    // 1. Notifications
    const [notif] = await connection.execute('DELETE FROM notifications WHERE user_id != ?', [adminId]);
    console.log(`- Deleted ${notif.affectedRows} notifications`);

    // 2. Evaluations
    const [evals] = await connection.execute('DELETE FROM evaluations WHERE evaluated_by != ?', [adminId]);
    console.log(`- Deleted ${evals.affectedRows} evaluations`);

    // 3. Staff Reports
    const [reports] = await connection.execute('DELETE FROM staff_reports WHERE submitted_by != ?', [adminId]);
    console.log(`- Deleted ${reports.affectedRows} staff reports`);

    // 4. Staff Process Assignments
    const [sAssignments] = await connection.execute('DELETE FROM staff_process_assignments WHERE staff_id != ?', [adminId]);
    console.log(`- Deleted ${sAssignments.affectedRows} staff process assignments`);

    // 5. Activity Tracking
    const [tracking] = await connection.execute('DELETE FROM activity_tracking WHERE updated_by != ?', [adminId]);
    console.log(`- Deleted ${tracking.affectedRows} activity tracking logs`);

    // 6. Activity Assignments
    const [aAssignments] = await connection.execute('DELETE FROM activity_assignments WHERE assigned_to_user_id != ? AND assigned_by != ?', [adminId, adminId]);
    console.log(`- Deleted ${aAssignments.affectedRows} activity assignments`);

    // 7. Committee Proposals
    const [proposals] = await connection.execute('DELETE FROM committee_proposals WHERE submitted_by != ?', [adminId]);
    console.log(`- Deleted ${proposals.affectedRows} committee proposals`);

    // 8. System Logs
    const [logs] = await connection.execute('DELETE FROM system_logs WHERE user_id != ?', [adminId]);
    console.log(`- Deleted ${logs.affectedRows} system logs`);

    // 9. User Committee Assignments
    const [commAssign] = await connection.execute('DELETE FROM user_committee_assignments WHERE user_id != ?', [adminId]);
    console.log(`- Deleted ${commAssign.affectedRows} user committee assignments`);

    // 10. User Roles
    const [roles] = await connection.execute('DELETE FROM user_roles WHERE user_id != ?', [adminId]);
    console.log(`- Deleted ${roles.affectedRows} user roles`);

    // 11. Final: Users
    const [uDeleted] = await connection.execute('DELETE FROM users WHERE id != ?', [adminId]);
    console.log(`- Deleted ${uDeleted.affectedRows} users from the main table`);

    await connection.commit();
    console.log('--- Cleanup Committed Successfully ---\n');

    const [finalUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`Final User Count: ${finalUsers[0].count}`);

  } catch (err) {
    await connection.rollback();
    console.error('--- Transaction Rolled Back due to Error ---');
    console.error(err);
  } finally {
    connection.release();
    await pool.end();
  }
}

go();
