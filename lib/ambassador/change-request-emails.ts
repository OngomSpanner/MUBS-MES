import { query } from '@/lib/db';
import {
  CHANGE_REQUEST_CATEGORIES,
  type ChangeRequestCategory,
} from '@/lib/ambassador/change-request-constants';
import { getHodRecipientsForDepartment } from '@/lib/hod-recipients';
import { brandEmailWrapper, escapeHtml, isSmtpConfigured, sendTransactionalMail } from '@/lib/mail';

function baseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function categoryLabel(category: ChangeRequestCategory): string {
  return CHANGE_REQUEST_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function buildReviewerNotificationHtml(args: {
  reviewerName: string;
  ambassadorName: string;
  managedUnitName: string;
  requestId: number;
  category: ChangeRequestCategory;
  title: string;
  description: string;
}): string {
  const appBase = baseUrl();
  const reviewUrl = `${appBase}/department-head?pg=evaluations&tab=proposals&id=${args.requestId}`;
  const reviewerName = escapeHtml(args.reviewerName || 'Colleague');
  const ambassadorName = escapeHtml(args.ambassadorName || 'An ambassador');
  const unitName = escapeHtml(args.managedUnitName || 'Unknown unit');
  const category = escapeHtml(categoryLabel(args.category));
  const title = escapeHtml(args.title);
  const description = escapeHtml(args.description).replace(/\n/g, '<br />');

  return brandEmailWrapper(`
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${reviewerName},</p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      <strong>${ambassadorName}</strong> (${unitName}) submitted a new change proposal in the MUBS M&amp;E System.
    </p>
    <div style="margin:0 0 16px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="color:#0f172a;font-size:14px;line-height:1.7;">
        <div><strong>Request #:</strong> ${args.requestId}</div>
        <div><strong>Category:</strong> ${category}</div>
        <div><strong>Title:</strong> ${title}</div>
        <div style="margin-top:8px;"><strong>Description:</strong></div>
        <div style="margin-top:4px;">${description}</div>
      </div>
    </div>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      Open the proposal in <strong>Ambassador Proposals</strong> to review:
      <a href="${reviewUrl}" style="color:#005696;text-decoration:none;">Review in M&amp;E System</a>
    </p>
    <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
      This is an automated notification. The request is stored as <strong>submitted</strong> until reviewed.
    </p>
  `);
}

export async function getChangeRequestReviewerRecipients(
  managedUnitId: number | null
): Promise<{ email: string; fullName: string }[]> {
  const recipients = await getHodRecipientsForDepartment(managedUnitId);
  return recipients.map((r) => ({ email: r.email, fullName: r.fullName }));
}

async function getAmbassadorDisplayName(userId: number): Promise<string> {
  const rows = (await query({
    query: 'SELECT full_name FROM users WHERE id = ? LIMIT 1',
    values: [userId],
  })) as { full_name: string | null }[];

  return String(rows[0]?.full_name || '').trim() || 'Strategic Plan Ambassador';
}

export async function notifyReviewersOfNewChangeRequest(args: {
  requestId: number;
  ambassadorUserId: number;
  managedUnitId: number | null;
  managedUnitName: string;
  category: ChangeRequestCategory;
  title: string;
  description: string;
}): Promise<{ sent: number; skipped: boolean }> {
  if (!isSmtpConfigured()) {
    console.warn('[change-request-emails] SMTP not configured; skipping reviewer notification');
    return { sent: 0, skipped: true };
  }

  const recipients = await getChangeRequestReviewerRecipients(args.managedUnitId);
  if (!recipients.length) {
    console.warn('[change-request-emails] No Head of Department recipients found for this unit');
    return { sent: 0, skipped: true };
  }

  const ambassadorName = await getAmbassadorDisplayName(args.ambassadorUserId);
  const subject = `[M&E] New ambassador change request: ${args.title}`;
  let sent = 0;

  for (const recipient of recipients) {
    const html = buildReviewerNotificationHtml({
      reviewerName: recipient.fullName,
      ambassadorName,
      managedUnitName: args.managedUnitName,
      requestId: args.requestId,
      category: args.category,
      title: args.title,
      description: args.description,
    });

    const ok = await sendTransactionalMail({
      to: recipient.email,
      subject,
      html,
    });
    if (ok) sent += 1;
  }

  return { sent, skipped: sent === 0 };
}
