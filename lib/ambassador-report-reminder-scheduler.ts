import { triggerAmbassadorAutoRemindersInBackground } from '@/lib/ambassador-report-auto-reminders';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let started = false;

/** Hourly check; sends weekly ambassador/HOD reporting reminders on configured weekday. */
export function startAmbassadorReminderScheduler(): void {
  if (started) return;
  started = true;

  const tick = () => triggerAmbassadorAutoRemindersInBackground(false);

  setTimeout(tick, 20_000);
  setInterval(tick, CHECK_INTERVAL_MS);

  console.log('[Ambassador reminders] Scheduler started (checks hourly).');
}
