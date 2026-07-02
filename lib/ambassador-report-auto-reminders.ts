import { query } from '@/lib/db';
import { sendAmbassadorReportReminders, type ReminderAudience } from '@/lib/ambassador-report-reminders';

const AUTO_AUDIENCES: ReminderAudience[] = ['not_started', 'in_progress', 'ready_to_submit'];

function isAutoRemindersEnabled(): boolean {
  const v = String(process.env.AMBASSADOR_AUTO_REMINDERS_ENABLED || 'true').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function configuredWeekday(): number {
  const raw = Number(process.env.AMBASSADOR_REMINDER_WEEKDAY ?? 1);
  return Number.isFinite(raw) && raw >= 0 && raw <= 6 ? raw : 1;
}

function hodAgingThresholdDays(): number {
  const raw = Number(process.env.AMBASSADOR_HOD_REMINDER_MIN_DAYS ?? 7);
  return Number.isFinite(raw) && raw >= 1 ? raw : 7;
}

async function autoRemindersRanToday(): Promise<boolean> {
  const rows = (await query({
    query: `
      SELECT COUNT(*) AS c FROM notification_deliveries
      WHERE event_type = 'indicator_reminder'
        AND payload_json LIKE '%"auto":true%'
        AND DATE(sent_at) = CURDATE()
    `,
  })) as { c: number }[];
  return Number(rows[0]?.c ?? 0) > 0;
}

export type AutoReminderRunResult = {
  ran: boolean;
  reason?: string;
  results?: Awaited<ReturnType<typeof sendAmbassadorReportReminders>>[];
};

/** Weekly automated ambassador / HOD reporting reminders. */
export async function tryRunAmbassadorAutoReminders(force = false): Promise<AutoReminderRunResult> {
  if (!isAutoRemindersEnabled()) {
    return { ran: false, reason: 'Auto reminders disabled (AMBASSADOR_AUTO_REMINDERS_ENABLED)' };
  }

  const now = new Date();
  if (!force && now.getDay() !== configuredWeekday()) {
    return { ran: false, reason: `Not reminder weekday (configured: ${configuredWeekday()})` };
  }

  if (!force && (await autoRemindersRanToday())) {
    return { ran: false, reason: 'Auto reminders already sent today' };
  }

  const results: Awaited<ReturnType<typeof sendAmbassadorReportReminders>>[] = [];

  for (const audience of AUTO_AUDIENCES) {
    results.push(await sendAmbassadorReportReminders(audience, { auto: true }));
  }

  const hodMinDays = hodAgingThresholdDays();
  results.push(await sendAmbassadorReportReminders('hod_pending', { auto: true, hodMinDays }));

  return { ran: true, results };
}

export function triggerAmbassadorAutoRemindersInBackground(force = false): void {
  void tryRunAmbassadorAutoReminders(force).then((result) => {
    if (result.ran) {
      console.log('[Ambassador reminders] Auto batch completed.', result.results);
    }
  }).catch((err) => {
    console.error('[Ambassador reminders] Auto batch failed:', err);
  });
}
