import { query } from '@/lib/db';

const RUN_KIND = 'auto_weekly';
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Africa/Kampala';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

export function appRunDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(date);
}

export function appWeekday(date = new Date()): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? date.getDay();
}

async function ensureAmbassadorReminderRunSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await query({
        query: `
          CREATE TABLE IF NOT EXISTS ambassador_reminder_runs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            run_date DATE NOT NULL,
            run_kind VARCHAR(32) NOT NULL DEFAULT 'auto_weekly',
            started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_ambassador_reminder_run (run_date, run_kind)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
      });
      schemaEnsured = true;
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

/** True if an automatic reminder batch already started for this calendar day (app timezone). */
export async function autoReminderBatchRanToday(): Promise<boolean> {
  await ensureAmbassadorReminderRunSchema();
  const runDate = appRunDateString();
  const rows = (await query({
    query: `
      SELECT 1 AS ok FROM ambassador_reminder_runs
      WHERE run_date = ? AND run_kind = ?
      LIMIT 1
    `,
    values: [runDate, RUN_KIND],
  })) as { ok: number }[];
  return rows.length > 0;
}

/**
 * Reserve today's auto-reminder batch before sending any emails.
 * Returns false if another process already reserved or completed today's batch.
 */
export async function tryAcquireAutoReminderBatch(): Promise<boolean> {
  await ensureAmbassadorReminderRunSchema();
  const runDate = appRunDateString();
  try {
    await query({
      query: `
        INSERT INTO ambassador_reminder_runs (run_date, run_kind, started_at)
        VALUES (?, ?, NOW())
      `,
      values: [runDate, RUN_KIND],
    });
    return true;
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'ER_DUP_ENTRY') return false;
    throw error;
  }
}

export async function markAutoReminderBatchComplete(): Promise<void> {
  await ensureAmbassadorReminderRunSchema();
  const runDate = appRunDateString();
  await query({
    query: `
      UPDATE ambassador_reminder_runs
      SET completed_at = NOW()
      WHERE run_date = ? AND run_kind = ? AND completed_at IS NULL
    `,
    values: [runDate, RUN_KIND],
  });
}
