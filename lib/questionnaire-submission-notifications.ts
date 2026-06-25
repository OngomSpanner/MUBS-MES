import { query } from '@/lib/db';
import { getHodRecipientsForDepartment } from '@/lib/hod-recipients';
import { brandEmailWrapper, escapeHtml, isSmtpConfigured, sendTransactionalMail } from '@/lib/mail';
import { insertAppNotification } from '@/lib/notifications';

function baseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

const HOD_REVIEW_PATH = '/department-head?pg=evaluations&tab=questionnaire';
const AMBASSADOR_REPORTING_PATH = '/ambassador?pg=reporting&tab=data-collection';

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
  const actionUrl = HOD_REVIEW_PATH;

  for (const recipient of recipients) {
    await insertAppNotification({
      userId: recipient.userId,
      title,
      message,
      type: 'info',
      relatedEntityType: 'questionnaire_indicator',
      relatedEntityId: args.indicatorId,
      actionUrl,
    });

    if (isSmtpConfigured()) {
      void sendTransactionalMail({
        to: recipient.email,
        subject: 'M&E: Performance indicator submitted for review',
        html: buildHodSubmitEmailHtml({
          reviewerName: recipient.fullName,
          ambassadorName,
          ctx,
        }),
      });
    }
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
  const title = isApprove ? 'Performance indicator approved' : 'Performance indicator needs revision';
  const message = isApprove
    ? `Your submission "${ctx.indicatorText}" was approved.`
    : `Your submission "${ctx.indicatorText}" was returned for revision.${args.comment ? ` Feedback: ${args.comment}` : ''}`;

  await insertAppNotification({
    userId: args.ambassadorUserId,
    title,
    message,
    type: isApprove ? 'success' : 'warning',
    relatedEntityType: 'questionnaire_indicator',
    relatedEntityId: args.indicatorId,
    actionUrl: AMBASSADOR_REPORTING_PATH,
  });

  if (isSmtpConfigured()) {
    void sendTransactionalMail({
      to: ambassador.email,
      subject: isApprove
        ? 'M&E: Performance indicator approved'
        : 'M&E: Performance indicator needs revision',
      html: buildAmbassadorReviewEmailHtml({
        ambassadorName: ambassador.fullName,
        ctx,
        action: args.action,
        comment: args.comment,
        reviewerName,
      }),
    });
  }
}
