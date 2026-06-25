/**
 * Insert test in-app notifications for a user.
 *
 * Usage:
 *   node scripts/test-in-app-notifications.js --list-users
 *   node scripts/test-in-app-notifications.js --email=ivan@mubs.ac.ug
 *   node scripts/test-in-app-notifications.js --user-id=5 --portal=hod
 *   node scripts/test-in-app-notifications.js --user-id=5 --portal=ambassador --type=success
 *
 * Options:
 *   --list-users          List active users (id, email, name)
 *   --user-id=N           Target user id
 *   --email=addr          Resolve user by email (instead of --user-id)
 *   --portal=hod|ambassador|ambassador-returned|staff|all  Sample(s) to insert (default: hod)
 *   --type=info|success|warning         Override notification type
 *   --count=N             How many copies (default: 1)
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const SAMPLES = {
  hod: {
    title: 'Performance indicator submitted for review',
    message:
      'Test Ambassador submitted "Number of ICT enabled infrastructure" (E-LEARNING) for review.',
    type: 'info',
    related_entity_type: 'questionnaire_indicator',
    related_entity_id: 1,
    action_url: '/department-head?pg=evaluations&tab=questionnaire',
  },
  ambassador_approved: {
    title: 'Performance indicator approved',
    message: 'Your submission "Number of ICT enabled infrastructure" was approved.',
    type: 'success',
    related_entity_type: 'questionnaire_indicator',
    related_entity_id: 1,
    action_url: '/ambassador?pg=reporting&tab=data-collection',
  },
  ambassador_returned: {
    title: 'Performance indicator needs revision',
    message:
      'Your submission "Number of ICT enabled infrastructure" was returned for revision. Feedback: Please correct FY 2024/2025 values.',
    type: 'warning',
    related_entity_type: 'questionnaire_indicator',
    related_entity_id: 1,
    action_url: '/ambassador?pg=reporting&tab=data-collection',
  },
  staff: {
    title: 'New process task assignment',
    message: 'Test: You were assigned a process task (script test).',
    type: 'info',
    related_entity_type: 'task',
    related_entity_id: 1,
    action_url: '/staff?pg=notifications',
  },
};

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function listUsers(connection) {
  const [rows] = await connection.execute(
    `SELECT id, email, full_name, role, status
     FROM users
     WHERE status = 'Active'
     ORDER BY id
     LIMIT 50`
  );
  console.log('\nActive users (first 50):\n');
  for (const u of rows) {
    console.log(`  id=${u.id}  ${u.email}  ${u.full_name || ''}  [${u.role || ''}]`);
  }
  console.log('\nUse: node scripts/test-in-app-notifications.js --user-id=<id> --portal=hod\n');
}

async function resolveUserId(connection) {
  const userId = arg('user-id');
  const email = arg('email');
  if (userId) return Number(userId);
  if (email) {
    const [rows] = await connection.execute(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND status = 'Active' LIMIT 1`,
      [email]
    );
    if (!rows[0]) throw new Error(`No active user for email: ${email}`);
    return rows[0].id;
  }
  throw new Error('Pass --user-id=N or --email=addr (or --list-users)');
}

function pickSamples(portal) {
  switch (portal) {
    case 'hod':
      return [SAMPLES.hod];
    case 'ambassador':
      return [SAMPLES.ambassador_approved];
    case 'ambassador-returned':
      return [SAMPLES.ambassador_returned];
    case 'staff':
      return [SAMPLES.staff];
    case 'all':
      return [SAMPLES.hod, SAMPLES.ambassador_approved, SAMPLES.staff];
    default:
      return [SAMPLES.hod];
  }
}

async function insertNotification(connection, userId, sample, hasActionUrl) {
  if (hasActionUrl) {
    const [result] = await connection.execute(
      `INSERT INTO notifications (
         user_id, title, message, related_entity_type, related_entity_id, type, is_urgent, action_url
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        userId,
        sample.title,
        sample.message,
        sample.related_entity_type,
        sample.related_entity_id,
        sample.type,
        sample.action_url,
      ]
    );
    return result.insertId;
  }

  const [result] = await connection.execute(
    `INSERT INTO notifications (
       user_id, title, message, related_entity_type, related_entity_id, type, is_urgent
     ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      userId,
      sample.title,
      sample.message,
      sample.related_entity_type,
      sample.related_entity_id,
      sample.type,
    ]
  );
  return result.insertId;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mubs_super_admin',
  });

  try {
    if (hasFlag('list-users')) {
      await listUsers(connection);
      return;
    }

    const userId = await resolveUserId(connection);
    const portal = arg('portal') || 'hod';
    const overrideType = arg('type');
    const count = Math.max(1, Number(arg('count') || 1));
    const hasActionUrl = await columnExists(connection, 'notifications', 'action_url');

    const [userRows] = await connection.execute(`SELECT id, email, full_name FROM users WHERE id = ?`, [
      userId,
    ]);
    if (!userRows[0]) throw new Error(`User id ${userId} not found`);

    const samples = pickSamples(portal).map((s) =>
      overrideType ? { ...s, type: overrideType } : s
    );

    console.log(`\nInserting test notification(s) for user #${userId} (${userRows[0].email})…`);
    if (!hasActionUrl) {
      console.warn('  Note: notifications.action_url column missing — inserting without action_url.');
    }

    const ids = [];
    for (let i = 0; i < count; i++) {
      for (const sample of samples) {
        const id = await insertNotification(connection, userId, sample, hasActionUrl);
        ids.push(id);
        console.log(`  inserted id=${id}  type=${sample.type}  title="${sample.title}"`);
      }
    }

    const [unread] = await connection.execute(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    console.log(`\nUnread count for user #${userId}: ${unread[0].c}`);
    console.log('\nOpen in browser:');
    if (portal === 'hod' || portal === 'all') {
      console.log('  HOD:        /department-head?pg=notifications');
    }
    if (portal.startsWith('ambassador') || portal === 'all') {
      console.log('  Ambassador: /ambassador?pg=notifications');
    }
    if (portal === 'staff' || portal === 'all') {
      console.log('  Staff:      /staff?pg=notifications');
    }
    console.log('');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exitCode = 1;
});
