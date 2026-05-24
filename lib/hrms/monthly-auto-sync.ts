import { isLastDayOfMonth } from './sync-schedule';
import { runFullDatabaseSync } from './run-database-sync';
import {
  monthlyAutoSyncRanToday,
  recordHrSyncRunComplete,
  recordHrSyncRunStart,
} from './sync-status';

let running = false;

export function isMonthlyAutoSyncRunning(): boolean {
  return running;
}

export type MonthlyAutoSyncResult =
  | { ran: false; reason: string }
  | {
      ran: true;
      total: number;
      updated: number;
      skippedNotInHr: number;
      errorCount: number;
    };

/** Full HR sync on the last day of each month (once per day). Safe to call repeatedly. */
export async function tryRunMonthlyAutoSync(): Promise<MonthlyAutoSyncResult> {
  if (running) {
    return { ran: false, reason: 'already_running' };
  }
  running = true;

  try {
    if (!isLastDayOfMonth()) {
      return { ran: false, reason: 'not_last_day_of_month' };
    }

    if (await monthlyAutoSyncRanToday()) {
      return { ran: false, reason: 'already_ran_today' };
    }

    const runId = await recordHrSyncRunStart('monthly_auto');

    console.log('[HRMS] Starting monthly automatic sync…');
    const result = await runFullDatabaseSync({
      onlyChanged: false,
      changedSinceDays: 0,
    });

    await recordHrSyncRunComplete(runId, {
      updated: result.updated,
      skippedNotInHr: result.skippedNotInHr,
      errorCount: result.errors.length,
    });

    console.log(
      `[HRMS] Monthly sync done — updated ${result.updated}, errors ${result.errors.length}`
    );

    return {
      ran: true,
      total: result.total,
      updated: result.updated,
      skippedNotInHr: result.skippedNotInHr,
      errorCount: result.errors.length,
    };
  } catch (error) {
    console.error('[HRMS] Monthly automatic sync failed:', error);
    throw error;
  } finally {
    running = false;
  }
}

/** Fire-and-forget monthly sync (for API status checks). */
export function triggerMonthlyAutoSyncInBackground(): void {
  void tryRunMonthlyAutoSync().catch((e) => {
    console.error('[HRMS] Background monthly sync error:', e);
  });
}
