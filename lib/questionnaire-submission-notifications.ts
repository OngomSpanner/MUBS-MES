import { query } from '@/lib/db';
import { getHodRecipientsForDepartment } from '@/lib/hod-recipients';
import { brandEmailWrapper, escapeHtml, isSmtpConfigured, sendTransactionalMail } from '@/lib/mail';
import {
  getNotificationDeliveryById,
  recordNotificationDelivery,
  updateNotificationDeliveryAfterRetry,
  type IndicatorNotificationPayload,
  type NotificationChannel,
  type NotificationEventType,
} from '@/lib/notification-deliveries';
import { insertAppNotification } from '@/lib/notifications';

function baseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export const HOD_REVIEW_PATH = '/department-head?pg=evaluations&tab=questionnaire';
export const AMBASSADOR_REPORTING_PATH = '/ambassador?pg=reporting&tab=data-collection';

type IndicatorContext = {
  indicatorText: string;
  outcomeLabel: string;
  departmentName: string;
};

async function loadIndicatorContext(
  indicatorId: number,
  departmentId: number
): Promise<IndicatorContext | null> {
  const rows = (await query({
    query: `
      SELECT i.indicator_text,
             CONCAT(o.type, ': ', o.label) AS outcome_label,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
      FROM q_indicators i
      JOIN q_outcomes o ON o.id = i.outcome_id
      JOIN departments d ON d.id = ?
      WHERE i.id = ?
      LIMIT 1
    `,
    values: [departmentId, indicatorId],
  })) as { indicator_text: string; outcome_label: string; department_name: string }[];

  const row = rows[0];
  if (!row) return null;
  return {
    indicatorText: String(row.indicator_text || '').trim() || 'Performance indicator',
    outcomeLabel: String(row.outcome_label || '').trim(),
    departmentName: String(row.department_name || '').trim() || 'Department',
  };
}

async function loadUserContact(userId: number): Promise<{ email: string; fullName: string } | null> {
  const rows = (await query({
    query: `SELECT email, full_name FROM users WHERE id = ? AND status = 'Active' LIMIT 1`,
    values: [userId],
  })) as { email: string | null; full_name: string | null }[];

  const row = rows[0];
  const email = String(row?.email || '').trim();
  if (!email) return null;
  return {
    email,
    fullName: String(row?.full_name || '').trim() || 'Colleague',
  };
}

function buildHodSubmitEmailHtml(args: {
  reviewerName: string;
  ambassadorName: string;
  ctx: IndicatorContext;
}): string {
  const reviewUrl = `${baseUrl()}${HOD_REVIEW_PATH}`;
  return brandEmailWrapper(`
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${escapeHtml(args.reviewerName)},</p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      <strong>${escapeHtml(args.ambassadorName)}</strong> submitted a performance indicator for your review in the MUBS M&amp;E System.
    </p>
    <div style="margin:0 0 16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="color:#0f172a;font-size:14px;line-height:1.7;">
        <div><strong>Indicator:</strong> ${escapeHtml(args.ctx.indicatorText)}</div>
        <div><strong>Department / unit:</strong> ${escapeHtml(args.ctx.departmentName)}</div>
        ${args.ctx.outcomeLabel ? `<div><strong>Outcome / output:</strong> ${escapeHtml(args.ctx.outcomeLabel)}</div>` : ''}
      </div>
    </div>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      Review in <strong>Submissions &amp; reviews → Performance indicators</strong>:
      <a href="${reviewUrl}" style="color:#005696;text-decoration:none;">Open in M&amp;E System</a>
    </p>
  `);
}

function buildAmbassadorReviewEmailHtml(args: {
  ambassadorName: string;
  ctx: IndicatorContext;
  action: 'approve' | 'return';
  comment: string | null;
  reviewerName: string;
}): string {
  const reportingUrl = `${baseUrl()}${AMBASSADOR_REPORTING_PATH}`;
  const outcome =
    args.action === 'approve'
      ? 'Your submission was <strong>approved</strong>.'
      : 'Your submission was <strong>returned for revision</strong>.';
  const commentBlock = args.comment
    ? `<p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;"><strong>Feedback:</strong><br/>${escapeHtml(args.comment).replace(/\n/g, '<br/>')}</p>`
    : '';

  return brandEmailWrapper(`
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${escapeHtml(args.ambassadorName)},</p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">${outcome}</p>
    <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Reviewed by <strong>${escapeHtml(args.reviewerName)}</strong>.
    </p>
    <div style="margin:0 0 16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="color:#0f172a;font-size:14px;line-height:1.7;">
        <div><strong>Indicator:</strong> ${escapeHtml(args.ctx.indicatorText)}</div>
        <div><strong>Department / unit:</strong> ${escapeHtml(args.ctx.departmentName)}</div>
      </div>
    </div>
    ${commentBlock}
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      Open <strong>Reporting → Performance Indicators</strong>:
      <a href="${reportingUrl}" style="color:#005696;text-decoration:none;">Open in M&amp;E System</a>
    </p>
  `);
}

async function deliverInApp(
  payload: IndicatorNotificationPayload,
  recipientUserId: number
): Promise<{ status: 'sent' | 'failed'; notificationId: number | null; error: string | null }> {
  try {
    const notificationId = await insertAppNotification({
      userId: recipientUserId,
      title: payload.title,
      message: payload.message,
      type: payload.notificationType,
      relatedEntityType: 'questionnaire_indicator',
      relatedEntityId: payload.indicatorId,
      actionUrl: payload.actionUrl,
    });
    return { status: 'sent', notificationId, error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'In-app notification failed';
    return { status: 'failed', notificationId: null, error: message };
  }
}

async function deliverEmail(
  payload: IndicatorNotificationPayload,
  recipientEmail: string,
  recipientFullName: string
): Promise<{ status: 'sent' | 'failed' | 'skipped'; error: string | null }> {
  if (!isSmtpConfigured()) {
    return { status: 'skipped', error: 'SMTP not configured' };
  }
  if (!recipientEmail.trim()) {
    return { status: 'skipped', error: 'No recipient email' };
  }

  const ctx = await loadIndicatorContext(payload.indicatorId, payload.departmentId);
  if (!ctx) {
    return { status: 'failed', error: 'Indicator context not found' };
  }

  let html = '';
  if (payload.eventType === 'indicator_submitted') {
    html = buildHodSubmitEmailHtml({
      reviewerName: recipientFullName,
      ambassadorName: payload.ambassadorName ?? 'An ambassador',
      ctx,
    });
  } else {
    html = buildAmbassadorReviewEmailHtml({
      ambassadorName: recipientFullName,
      ctx,
      action: payload.reviewAction === 'return' ? 'return' : 'approve',
      comment: payload.reviewComment ?? null,
      reviewerName: payload.reviewerName ?? 'Head of Department',
    });
  }

  const subject = payload.emailSubject ?? 'M&E: Notification';
  const ok = await sendTransactionalMail({ to: recipientEmail, subject, html });
  if (ok) return { status: 'sent', error: null };
  return { status: 'failed', error: 'SMTP send failed' };
}

async function logDelivery(
  eventType: NotificationEventType,
  payload: IndicatorNotificationPayload,
  recipientUserId: number,
  recipientEmail: string | null,
  channel: NotificationChannel,
  result: { status: 'sent' | 'failed' | 'skipped'; notificationId?: number | null; error?: string | null }
): Promise<void> {
  await recordNotificationDelivery({
    eventType,
    indicatorId: payload.indicatorId,
    departmentId: payload.departmentId,
    recipientUserId,
    recipientEmail,
    channel,
    status: result.status,
    errorMessage: result.error ?? null,
    inAppNotificationId: result.notificationId ?? null,
    emailSubject: payload.emailSubject ?? null,
    payload,
  });
}

/** Ambassador submitted indicator for HOD review. */
export async function notifyHodsOfIndicatorSubmission(args: {
  indicatorId: number;
  departmentId: number;
  submittedByUserId: number;
}): Promise<void> {
  const ctx = await loadIndicatorContext(args.indicatorId, args.departmentId);
  if (!ctx) return;

  const ambassador = await loadUserContact(args.submittedByUserId);
  const ambassadorName = ambassador?.fullName ?? 'An ambassador';

  const recipients = await getHodRecipientsForDepartment(args.departmentId);
  if (!recipients.length) return;

  const title = 'Performance indicator submitted for review';
  const message = `${ambassadorName} submitted "${ctx.indicatorText}" (${ctx.departmentName}) for review.`;
  const emailSubject = 'M&E: Performance indicator submitted for review';

  const payloadBase: IndicatorNotificationPayload = {
    eventType: 'indicator_submitted',
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    submittedByUserId: args.submittedByUserId,
    ambassadorName,
    title,
    message,
    notificationType: 'info',
    actionUrl: HOD_REVIEW_PATH,
    emailSubject,
  };

  for (const recipient of recipients) {
    const payload: IndicatorNotificationPayload = {
      ...payloadBase,
      recipientFullName: recipient.fullName,
    };

    const inApp = await deliverInApp(payload, recipient.userId);
    await logDelivery('indicator_submitted', payload, recipient.userId, recipient.email, 'in_app', {
      status: inApp.status,
      notificationId: inApp.notificationId,
      error: inApp.error,
    });

    const email = await deliverEmail(payload, recipient.email, recipient.fullName);
    await logDelivery('indicator_submitted', payload, recipient.userId, recipient.email, 'email', {
      status: email.status,
      error: email.error,
    });
  }
}

/** HOD approved or returned an indicator submission. */
export async function notifyAmbassadorOfIndicatorReview(args: {
  indicatorId: number;
  departmentId: number;
  ambassadorUserId: number;
  reviewerUserId: number;
  action: 'approve' | 'return';
  comment: string | null;
}): Promise<void> {
  const ctx = await loadIndicatorContext(args.indicatorId, args.departmentId);
  if (!ctx) return;

  const ambassador = await loadUserContact(args.ambassadorUserId);
  if (!ambassador) return;

  const reviewerRows = (await query({
    query: 'SELECT full_name FROM users WHERE id = ? LIMIT 1',
    values: [args.reviewerUserId],
  })) as { full_name: string | null }[];
  const reviewerName = String(reviewerRows[0]?.full_name || '').trim() || 'Head of Department';

  const isApprove = args.action === 'approve';
  const eventType: NotificationEventType = isApprove ? 'indicator_approved' : 'indicator_returned';
  const title = isApprove ? 'Performance indicator approved' : 'Performance indicator needs revision';
  const message = isApprove
    ? `Your submission "${ctx.indicatorText}" was approved.`
    : `Your submission "${ctx.indicatorText}" was returned for revision.${args.comment ? ` Feedback: ${args.comment}` : ''}`;
  const emailSubject = isApprove
    ? 'M&E: Performance indicator approved'
    : 'M&E: Performance indicator needs revision';

  const payload: IndicatorNotificationPayload = {
    eventType,
    indicatorId: args.indicatorId,
    departmentId: args.departmentId,
    submittedByUserId: args.ambassadorUserId,
    reviewerUserId: args.reviewerUserId,
    reviewAction: args.action,
    reviewComment: args.comment,
    recipientFullName: ambassador.fullName,
    reviewerName,
    title,
    message,
    notificationType: isApprove ? 'success' : 'warning',
    actionUrl: AMBASSADOR_REPORTING_PATH,
    emailSubject,
  };

  const inApp = await deliverInApp(payload, args.ambassadorUserId);
  await logDelivery(eventType, payload, args.ambassadorUserId, ambassador.email, 'in_app', {
    status: inApp.status,
    notificationId: inApp.notificationId,
    error: inApp.error,
  });

  const email = await deliverEmail(payload, ambassador.email, ambassador.fullName);
  await logDelivery(eventType, payload, args.ambassadorUserId, ambassador.email, 'email', {
    status: email.status,
    error: email.error,
  });
}

/** Admin resend for a single delivery row (in-app or email only). */
export async function resendNotificationDelivery(
  deliveryId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await getNotificationDeliveryById(deliveryId);
  if (!row) return { ok: false, message: 'Delivery record not found' };

  let payload: IndicatorNotificationPayload;
  try {
    payload =
      typeof row.payload_json === 'string'
        ? (JSON.parse(row.payload_json) as IndicatorNotificationPayload)
        : (row.payload_json as unknown as IndicatorNotificationPayload);
  } catch {
    return { ok: false, message: 'Invalid stored payload' };
  }

  const email = String(row.recipient_email || '').trim();
  const fullName = String(row.recipient_name || payload.recipientFullName || 'Colleague');

  if (row.channel === 'in_app') {
    const inApp = await deliverInApp(payload, row.recipient_user_id);
    await updateNotificationDeliveryAfterRetry(deliveryId, {
      status: inApp.status,
      errorMessage: inApp.error,
      inAppNotificationId: inApp.notificationId,
    });
    if (inApp.status === 'sent') return { ok: true };
    return { ok: false, message: inApp.error ?? 'In-app resend failed' };
  }

  if (row.channel === 'email') {
    const result = await deliverEmail(payload, email, fullName);
    await updateNotificationDeliveryAfterRetry(deliveryId, {
      status: result.status === 'skipped' ? 'failed' : result.status,
      errorMessage: result.error,
    });
    if (result.status === 'sent') return { ok: true };
    return { ok: false, message: result.error ?? 'Email resend failed' };
  }

  return { ok: false, message: 'Unknown channel' };
}
