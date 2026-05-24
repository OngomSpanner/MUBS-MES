export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startHrmsMonthlySyncScheduler } = await import('./lib/hrms/monthly-sync-scheduler');
    startHrmsMonthlySyncScheduler();
  }
}
