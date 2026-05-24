import { query } from '@/lib/db';
import { buildChangedUsersWhere } from './sync-queries';
import { syncBatchFromSearchQueries, type SyncBatchSummary } from './sync-user';

const BATCH_SIZE = 50;

export type DatabaseSyncOptions = {
  onlyChanged: boolean;
  changedSinceDays: number;
  dryRun?: boolean;
  delayMs?: number;
};

export type FullDatabaseSyncResult = {
  total: number;
  updated: number;
  skippedNotInHr: number;
  errors: Array<{ query: string; message: string }>;
};

/** Run HR database sync for all matching users (server-side batches). */
export async function runFullDatabaseSync(
  options: DatabaseSyncOptions
): Promise<FullDatabaseSyncResult> {
  const { onlyChanged, changedSinceDays, dryRun = false, delayMs } = options;
  const where = buildChangedUsersWhere(onlyChanged, changedSinceDays);
  const perBatchDelay = delayMs ?? (onlyChanged ? 60 : 120);

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE ${where}`,
    values: [],
  })) as { c: number }[];

  const total = Number(countRows[0]?.c ?? 0);
  let offset = 0;
  let updated = 0;
  let skippedNotInHr = 0;
  const errors: Array<{ query: string; message: string }> = [];

  while (offset < total) {
    const rows = (await query({
      query: `SELECT email FROM users
              WHERE ${where}
              ORDER BY id ASC
              LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
      values: [],
    })) as { email: string }[];

    const emails = rows.map((r) => String(r.email).trim()).filter(Boolean);
    if (emails.length === 0) break;

    const summary: SyncBatchSummary = await syncBatchFromSearchQueries(emails, {
      dryRun,
      createIfMissing: false,
      delayMs: perBatchDelay,
    });

    updated += summary.updated;
    skippedNotInHr += summary.skippedNotInHr;
    errors.push(...summary.errors);

    offset += emails.length;
  }

  return { total, updated, skippedNotInHr, errors };
}
