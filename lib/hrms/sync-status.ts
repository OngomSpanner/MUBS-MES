import { query } from '@/lib/db';
import {
  formatSyncDate,
  formatSyncDateTime,
  getNextMonthlySyncDate,
  isLastDayOfMonth,
} from './sync-schedule';

export type HrSyncStatus = {
  lastSyncAt: string | null;
  lastSyncLabel: string;
  nextMonthlySync: string;
  nextMonthlySyncLabel: string;
  monthlySyncDue: boolean;
  monthlySyncRanToday: boolean;
  shouldAutoStartMonthly: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = (await query({
      query: `SELECT 1 AS ok FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      values: [table],
    })) as { ok: number }[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function getHrSyncStatus(): Promise<HrSyncStatus> {
  let lastSyncAt: string | null = null;
  try {
    const rows = (await query({
      query: `SELECT MAX(hrms_last_synced_at) AS last_sync
              FROM users WHERE hrms_last_synced_at IS NOT NULL`,
      values: [],
    })) as { last_sync: Date | string | null }[];
    const raw = rows[0]?.last_sync;
    if (raw) lastSyncAt = new Date(raw).toISOString();
  } catch {
    /* ignore */
  }

  const nextMonthly = getNextMonthlySyncDate();
  const monthlySyncDue = isLastDayOfMonth();

  let monthlySyncRanToday = false;
  if (await tableExists('hr_sync_runs')) {
    try {
      const runs = (await query({
        query: `SELECT 1 AS ok FROM hr_sync_runs
                WHERE run_type = 'monthly_auto' AND DATE(started_at) = CURDATE()
                LIMIT 1`,
        values: [],
      })) as { ok: number }[];
      monthlySyncRanToday = runs.length > 0;
    } catch {
      /* ignore */
    }
  }

  return {
    lastSyncAt,
    lastSyncLabel: formatSyncDateTime(lastSyncAt) || 'Never',
    nextMonthlySync: nextMonthly.toISOString().slice(0, 10),
    nextMonthlySyncLabel: formatSyncDate(nextMonthly) || '—',
    monthlySyncDue,
    monthlySyncRanToday,
    shouldAutoStartMonthly: monthlySyncDue && !monthlySyncRanToday,
  };
}

export async function recordHrSyncRunStart(runType: string): Promise<number | null> {
  if (!(await tableExists('hr_sync_runs'))) return null;
  const result = await query({
    query: `INSERT INTO hr_sync_runs (run_type, started_at) VALUES (?, NOW())`,
    values: [runType],
  });
  return (result as { insertId?: number }).insertId ?? null;
}

export async function recordHrSyncRunComplete(
  runId: number | null,
  stats: { updated: number; skippedNotInHr: number; errorCount: number }
): Promise<void> {
  if (!runId || !(await tableExists('hr_sync_runs'))) return;
  await query({
    query: `UPDATE hr_sync_runs SET
      completed_at = NOW(),
      updated_count = ?,
      skipped_not_in_hr = ?,
      error_count = ?
    WHERE id = ?`,
    values: [stats.updated, stats.skippedNotInHr, stats.errorCount, runId],
  });
}

export async function monthlyAutoSyncRanToday(): Promise<boolean> {
  if (!(await tableExists('hr_sync_runs'))) return false;
  const runs = (await query({
    query: `SELECT 1 AS ok FROM hr_sync_runs
            WHERE run_type = 'monthly_auto' AND DATE(started_at) = CURDATE()
            LIMIT 1`,
    values: [],
  })) as { ok: number }[];
  return runs.length > 0;
}
