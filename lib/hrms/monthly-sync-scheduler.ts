import { triggerMonthlyAutoSyncInBackground } from './monthly-auto-sync';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

let started = false;

/**
 * Runs while the Next.js server is up. On the last day of each month,
 * triggers a full HR sync once per day even if no admin opens User Management.
 */
export function startHrmsMonthlySyncScheduler(): void {
  if (started) return;
  started = true;

  const tick = () => {
    triggerMonthlyAutoSyncInBackground();
  };

  // Check soon after boot, then hourly
  setTimeout(tick, 15_000);
  setInterval(tick, CHECK_INTERVAL_MS);

  console.log('[HRMS] Monthly sync scheduler started (checks hourly on last day of month).');
}
