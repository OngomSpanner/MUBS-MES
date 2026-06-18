/**
 * Sync M&E users from MUBS HRMS API (no Excel).
 * Run: npm run sync:hrms -- --dry-run --from-db
 */
import mysql from 'mysql2/promise';
import { buildChangedUsersWhere } from '../lib/hrms/sync-queries';
import { importNewStaffFromHrmsBatch } from '../lib/hrms/sync-import';

function parseArgs(argv: string[]) {
  const opts = {
    dryRun: false,
    email: null as string | null,
    search: null as string | null,
    fromDb: false,
    tryList: false,
    importNew: false,
    onlyChanged: false,
    changedSinceDays: parseInt(process.env.HRMS_SYNC_CHANGED_DAYS || '7', 10),
    limit: 50,
    offset: 0,
    delayMs: 150,
    createIfMissing: true,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--from-db') opts.fromDb = true;
    else if (arg === '--try-hrms-list') opts.tryList = true;
    else if (arg === '--import-new') opts.importNew = true;
    else if (arg === '--only-changed') opts.onlyChanged = true;
    else if (arg.startsWith('--changed-since-days='))
      opts.changedSinceDays = Math.max(0, parseInt(arg.slice(21), 10) || 0);
    else if (arg.startsWith('--email=')) opts.email = arg.slice(8);
    else if (arg.startsWith('--search=')) opts.search = arg.slice(9);
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice(8)) || 50;
    else if (arg.startsWith('--offset=')) opts.offset = Number(arg.slice(9)) || 0;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.slice(11)) || 150;
    else if (arg === '--no-create') opts.createIfMissing = false;
  }
  return opts;
}

async function getDbEmails(
  connection: mysql.Connection,
  limit: number,
  offset: number,
  onlyChanged: boolean,
  changedSinceDays: number
) {
  const limitInt = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
  const offsetInt = Math.max(parseInt(String(offset), 10) || 0, 0);
  const where = buildChangedUsersWhere(onlyChanged, changedSinceDays);
  const [rows] = await connection.execute(
    `SELECT email FROM users
     WHERE ${where}
     ORDER BY id ASC
     LIMIT ${limitInt} OFFSET ${offsetInt}`
  );
  return (rows as { email: string }[]).map((r) => String(r.email).trim()).filter(Boolean);
}

async function countDbEmails(
  connection: mysql.Connection,
  onlyChanged: boolean,
  changedSinceDays: number
) {
  const where = buildChangedUsersWhere(onlyChanged, changedSinceDays);
  const [rows] = await connection.execute(`SELECT COUNT(*) AS c FROM users WHERE ${where}`);
  return Number((rows as { c: number }[])[0].c);
}

async function runImportNew(opts: ReturnType<typeof parseArgs>) {
  let offset = opts.offset;
  for (;;) {
    const result = await importNewStaffFromHrmsBatch(offset, opts.limit, { dryRun: opts.dryRun });
    console.log(JSON.stringify(result, null, 2));
    if (result.nextOffset == null) break;
    offset = result.nextOffset;
  }
}

async function main() {
  const { hrmsTryListAllStaff } = await import('../lib/hrms/client');
  const {
    syncBatchFromSearchQueries,
    syncUserFromHrmsSearch,
  } = await import('../lib/hrms/sync-user');

  const opts = parseArgs(process.argv.slice(2));

  if (opts.importNew) {
    await runImportNew(opts);
    return;
  }

  if (opts.tryList) {
    console.log('Trying HRMS roster endpoints…');
    const list = await hrmsTryListAllStaff();
    console.log(`HRMS list returned ${list.length} staff`);
    if (list.length === 0) {
      console.log('No roster API found. Use --from-db to sync by emails in M&E users table.');
      return;
    }
    const queries = list
      .slice(0, opts.limit)
      .map((s) => (s.email ? String(s.email) : `${s.firstname || ''} ${s.surname || ''}`.trim()))
      .filter(Boolean);
    const summary = await syncBatchFromSearchQueries(queries, {
      dryRun: opts.dryRun,
      createIfMissing: opts.createIfMissing,
      delayMs: opts.delayMs,
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (opts.email || opts.search) {
    const q = opts.email || opts.search!;
    const result = await syncUserFromHrmsSearch(q, {
      dryRun: opts.dryRun,
      createIfMissing: opts.createIfMissing,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (opts.fromDb) {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
    });
    try {
      const total = await countDbEmails(connection, opts.onlyChanged, opts.changedSinceDays);
      const emails = await getDbEmails(
        connection,
        opts.limit,
        opts.offset,
        opts.onlyChanged,
        opts.changedSinceDays
      );
      const mode = opts.onlyChanged
        ? `changed only (days=${opts.changedSinceDays})`
        : 'all users';
      console.log(
        `Syncing ${emails.length} emails — ${mode} (offset ${opts.offset}, total: ${total})${opts.dryRun ? ' [DRY RUN]' : ''}…`
      );
      const delayMs = opts.onlyChanged ? 60 : opts.delayMs;
      const summary = await syncBatchFromSearchQueries(emails, {
        dryRun: opts.dryRun,
        createIfMissing: false,
        delayMs,
      });
      console.log(JSON.stringify(summary, null, 2));
      if (opts.offset + emails.length < total) {
        console.log(
          `Next batch: npm run sync:hrms -- --from-db --offset=${opts.offset + opts.limit} --limit=${opts.limit}${opts.onlyChanged ? ' --only-changed' : ''}`
        );
      }
    } finally {
      await connection.end();
    }
    return;
  }

  console.log(`Usage:
  npm run sync:hrms -- --dry-run --from-db
  npm run sync:hrms -- --from-db --only-changed
  npm run sync:hrms -- --from-db --only-changed --changed-since-days=7
  npm run sync:hrms -- --import-new
  npm run sync:hrms -- --from-db --limit=100 --offset=0
  npm run sync:hrms -- --email=user@mubs.ac.ug
  npm run sync:hrms -- --search="Name"
  npm run sync:hrms -- --try-hrms-list`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
