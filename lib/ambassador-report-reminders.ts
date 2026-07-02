import { getHodRecipientsForDepartment } from '@/lib/hod-recipients';
import { brandEmailWrapper, escapeHtml, isSmtpConfigured, sendTransactionalMail } from '@/lib/mail';
import {
  recordNotificationDelivery,
  type IndicatorNotificationPayload,
  type NotificationChannel,
} from '@/lib/notification-deliveries';
import { insertAppNotification } from '@/lib/notifications';
import { HOD_REVIEW_PATH, AMBASSADOR_REPORTING_PATH } from '@/lib/questionnaire-submission-notifications';
import {
  getAmbassadorReportsSummary,
  type AssignmentRow,
} from '@/lib/admin/ambassador-reports-aggregate';

export type ReminderAudience =
  | 'not_started'
  | 'in_progress'
  | 'ready_to_submit'
  | 'hod_pending';

export type ReminderResult = {
  audience: ReminderAudience;
  recipientsNotified: number;
  emailsSent: number;
  inAppCreated: number;
  skippedNoContact: number;
};

function baseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function filterAssignments(
  assignments: AssignmentRow[],
  audience: ReminderAudience,
): AssignmentRow[] {
  switch (audience) {
    case 'not_started':
      return assignments.filter((a) => a.progressStatus === 'not-started');
    case 'in_progress':
      return assignments.filter((a) => a.progressStatus === 'partial');
    case 'ready_to_submit':
      return assignments.filter(
        (a) =>
          a.progressStatus === 'complete'
          && (a.hodReviewStatus === 'draft' || a.hodReviewStatus === 'returned'),
      );
    case 'hod_pending':
      return assignments.filter((a) => a.hodReviewStatus === 'submitted');
    default:
      return [];
  }
}

function ambassadorReminderCopy(audience: ReminderAudience, count: number): { title: string; message: string } {
  const items = count === 1 ? '1 indicator assignment' : `${count} indicator assignments`;
  switch (audience) {
    case 'not_started':
      return {
        title: 'Questionnaire reporting reminder',
        message: `You have ${items} that have not been started. Please log in and begin data collection.`,
      };
    case 'in_progress':
      return {
        title: 'Complete your questionnaire reporting',
        message: `You have ${items} in progress. Please complete and submit for HOD review.`,
      };
    case 'ready_to_submit':
      return {
        title: 'Submit completed indicators for review',
        message: `You have ${items} ready to submit to your Head of Department.`,
      };
    default:
      return { title: 'Reporting reminder', message: 'Please review your questionnaire reporting tasks.' };
  }
}

function hodReminderCopy(count: number): { title: string; message: string } {
  const items = count === 1 ? '1 indicator submission' : `${count} indicator submissions`;
  return {
    title: 'Questionnaire review pending',
    message: `${items} from your ambassador(s) are awaiting your approval in Submissions & reviews.`,
  };
}

async function notifyAmbassadorUser(args: {
  userId: number;
  email: string;
  name: string;
  audience: ReminderAudience;
  count: number;
  departmentId: number;
  indicatorId: number;
  auto?: boolean;
}): Promise<{ email: boolean; inApp: boolean }> {
  const copy = ambassadorReminderCopy(args.audience, args.count);
  const actionUrl = AMBASSADOR_REPORTING_PATH;

  const inAppId = await insertAppNotification({
    userId: args.userId,
    title: copy.title,
    message: copy.message,
    type: 'warning',
    relatedEntityType: 'questionnaire_indicator',
    relatedEntityId: args.indicatorId,
    actionUrl,
    isUrgent: args.audience === 'ready_to_submit',
  });

  let emailSent = false;
  let emailError: string | null = null;
  if (isSmtpConfigured() && args.email) {
    const html = brandEmailWrapper(`
      <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${escapeHtml(args.name)},</p>
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">${escapeHtml(copy.message)}</p>
      <p style="margin:20px 0;">
        <a href="${escapeHtml(`${baseUrl()}${actionUrl}`)}"
           style="background:#003366;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
          Open data collection
        </a>
      </p>
    `);
    try {
      const ok = await sendTransactionalMail({
        to: args.email,
        subject: copy.title,
        html,
      });
      emailSent = Boolean(ok);
      if (!ok) emailError = 'SMTP send failed';
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email send failed';
      console.error('ambassador reminder email failed:', err);
    }
  }

  const payload: IndicatorNotificationPayload = {
    eventType: 'indicator_reminder',
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    title: copy.title,
    message: copy.message,
    notificationType: 'warning',
    actionUrl,
    emailSubject: copy.title,
    indicatorCount: args.count,
    recipientFullName: args.name,
    auto: args.auto,
  };

  const channel: NotificationChannel = emailSent ? 'email' : 'in_app';
  await recordNotificationDelivery({
    eventType: 'indicator_reminder',
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    recipientUserId: args.userId,
    recipientEmail: args.email,
    channel,
    status: inAppId != null || emailSent ? 'sent' : 'failed',
    errorMessage: emailError,
    inAppNotificationId: inAppId,
    emailSubject: copy.title,
    payload,
  });

  return { email: emailSent, inApp: inAppId != null };
}

async function notifyHodUser(args: {
  userId: number;
  email: string;
  name: string;
  count: number;
  departmentId: number;
  indicatorId: number;
  auto?: boolean;
}): Promise<{ email: boolean; inApp: boolean }> {
  const copy = hodReminderCopy(args.count);
  const actionUrl = HOD_REVIEW_PATH;

  const inAppId = await insertAppNotification({
    userId: args.userId,
    title: copy.title,
    message: copy.message,
    type: 'warning',
    relatedEntityType: 'questionnaire_indicator',
    relatedEntityId: args.indicatorId,
    actionUrl,
    isUrgent: true,
  });

  let emailSent = false;
  let emailError: string | null = null;
  if (isSmtpConfigured() && args.email) {
    const html = brandEmailWrapper(`
      <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${escapeHtml(args.name)},</p>
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">${escapeHtml(copy.message)}</p>
      <p style="margin:20px 0;">
        <a href="${escapeHtml(`${baseUrl()}${actionUrl}`)}"
           style="background:#003366;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
          Review submissions
        </a>
      </p>
    `);
    try {
      const ok = await sendTransactionalMail({
        to: args.email,
        subject: copy.title,
        html,
      });
      emailSent = Boolean(ok);
      if (!ok) emailError = 'SMTP send failed';
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email send failed';
      console.error('HOD reminder email failed:', err);
    }
  }

  const payload: IndicatorNotificationPayload = {
    eventType: 'indicator_reminder',
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    title: copy.title,
    message: copy.message,
    notificationType: 'warning',
    actionUrl,
    emailSubject: copy.title,
    indicatorCount: args.count,
    recipientFullName: args.name,
    auto: args.auto,
  };

  const channel: NotificationChannel = emailSent ? 'email' : 'in_app';
  await recordNotificationDelivery({
    eventType: 'indicator_reminder',
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    recipientUserId: args.userId,
    recipientEmail: args.email,
    channel,
    status: inAppId != null || emailSent ? 'sent' : 'failed',
    errorMessage: emailError,
    inAppNotificationId: inAppId,
    emailSubject: copy.title,
    payload,
  });

  return { email: emailSent, inApp: inAppId != null };
}

export async function sendAmbassadorReportReminders(
  audience: ReminderAudience,
  options?: { auto?: boolean; hodMinDays?: number },
): Promise<ReminderResult> {
  const summary = await getAmbassadorReportsSummary();
  let filtered = filterAssignments(summary.assignments, audience);

  if (audience === 'hod_pending' && options?.hodMinDays != null && options.hodMinDays > 0) {
    filtered = filtered.filter((a) => {
      if (!a.submittedAt) return false;
      const days = Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= options.hodMinDays!;
    });
  }

  if (filtered.length === 0) {
    return {
      audience,
      recipientsNotified: 0,
      emailsSent: 0,
      inAppCreated: 0,
      skippedNoContact: 0,
    };
  }

  const result: ReminderResult = {
    audience,
    recipientsNotified: 0,
    emailsSent: 0,
    inAppCreated: 0,
    skippedNoContact: 0,
  };

  if (audience === 'hod_pending') {
    const byDept = new Map<number, AssignmentRow[]>();
    for (const a of filtered) {
      const list = byDept.get(a.departmentId) ?? [];
      list.push(a);
      byDept.set(a.departmentId, list);
    }

    const notifiedHods = new Set<number>();
    for (const [departmentId, rows] of byDept) {
      const hods = await getHodRecipientsForDepartment(departmentId);
      const sample = rows[0];
      for (const hod of hods) {
        if (notifiedHods.has(hod.userId)) continue;
        notifiedHods.add(hod.userId);
    const out = await notifyHodUser({
          userId: hod.userId,
          email: hod.email,
          name: hod.fullName,
          count: rows.length,
          departmentId,
          indicatorId: sample.indicatorId,
          auto: options?.auto,
        });
        result.recipientsNotified += 1;
        if (out.email) result.emailsSent += 1;
        if (out.inApp) result.inAppCreated += 1;
      }
      if (hods.length === 0) result.skippedNoContact += 1;
    }
    return result;
  }

  const byAmbassador = new Map<number, { userId: number; email: string; name: string; rows: AssignmentRow[] }>();
  for (const a of filtered) {
    if (!a.ambassadorUserId) {
      result.skippedNoContact += 1;
      continue;
    }
    let entry = byAmbassador.get(a.ambassadorUserId);
    if (!entry) {
      entry = {
        userId: a.ambassadorUserId,
        email: a.ambassadorEmail || '',
        name: a.ambassadorName || 'Ambassador',
        rows: [],
      };
      byAmbassador.set(a.ambassadorUserId, entry);
    }
    entry.rows.push(a);
  }

  for (const entry of byAmbassador.values()) {
    if (!entry.email) {
      result.skippedNoContact += 1;
      continue;
    }
    const sample = entry.rows[0];
    const out = await notifyAmbassadorUser({
      userId: entry.userId,
      email: entry.email,
      name: entry.name,
      audience,
      count: entry.rows.length,
      departmentId: sample.departmentId,
      indicatorId: sample.indicatorId,
      auto: options?.auto,
    });
    result.recipientsNotified += 1;
    if (out.email) result.emailsSent += 1;
    if (out.inApp) result.inAppCreated += 1;
  }

  return result;
}
