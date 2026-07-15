import { brandEmailWrapper, escapeHtml, sendTransactionalMail } from '@/lib/mail';
import { insertAppNotification } from '@/lib/notifications';
import { query } from '@/lib/db';

type NotifyArgs = {
  staffUserId: number;
  assignmentId: number;
  activityName: string;
  standardTitle: string;
  standardCode: string;
  pillar: string | null;
  durationText: string | null;
  targetDate: string | null;
  assignedByName: string;
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

/** In-app notification + clear email when a staff member is assigned an SDS activity. */
export async function notifyStaffSdsAssignment(args: NotifyArgs): Promise<void> {
  const staffLink = `${appBaseUrl()}/staff?pg=sds`;
  const target = args.targetDate ? String(args.targetDate).slice(0, 10) : 'Not set';
  const pillar = args.pillar || 'Strategic pillar';
  const duration = args.durationText || 'As scheduled';

  const title = 'New SDS activity assigned';
  const message =
    `You have been assigned “${args.activityName}” under ${args.standardTitle} (${pillar}). ` +
    `Target date: ${target}. Assigned by ${args.assignedByName}. ` +
    `Open My SDS Activities for details. Completion is recorded at appraisal.`;

  try {
    await insertAppNotification({
      userId: args.staffUserId,
      title,
      message,
      type: 'info',
      relatedEntityType: 'sds_assignment',
      relatedEntityId: args.assignmentId,
      actionUrl: '/staff?pg=sds',
    });
  } catch (e) {
    console.error('sds assignment in-app notification failed', e);
  }

  try {
    const users = (await query({
      query: 'SELECT email, full_name FROM users WHERE id = ? LIMIT 1',
      values: [args.staffUserId],
    })) as { email: string | null; full_name: string | null }[];
    const email = String(users[0]?.email || '').trim();
    const name = String(users[0]?.full_name || 'Colleague').trim();
    if (!email) return;

    const inner = `
<p style="color:#333333;font-size:16px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
<p style="color:#333333;font-size:16px;line-height:1.6;">
  You have been assigned a <strong>Service Delivery Standard (SDS)</strong> process activity.
</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#333;">
  <tr><td style="padding:8px 0;color:#666;width:140px;">Activity</td><td style="padding:8px 0;"><strong>${escapeHtml(args.activityName)}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666;">Standard</td><td style="padding:8px 0;">${escapeHtml(args.standardTitle)}</td></tr>
  <tr><td style="padding:8px 0;color:#666;">Pillar</td><td style="padding:8px 0;">${escapeHtml(pillar)}</td></tr>
  <tr><td style="padding:8px 0;color:#666;">Duration</td><td style="padding:8px 0;">${escapeHtml(duration)}</td></tr>
  <tr><td style="padding:8px 0;color:#666;">Target date</td><td style="padding:8px 0;"><strong>${escapeHtml(target)}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666;">Assigned by</td><td style="padding:8px 0;">${escapeHtml(args.assignedByName)}</td></tr>
</table>
<p style="color:#333333;font-size:15px;line-height:1.6;">
  This is a read-only assignment in the M&amp;E system for tracking. Progress is recorded through HR appraisal — you do not mark this complete in the portal.
</p>
<p style="text-align:center;margin:28px 0;">
  <a href="${escapeHtml(staffLink)}"
     style="background:#005696;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:bold;">
    View my SDS activities
  </a>
</p>
<p style="color:#666666;font-size:13px;">Or open: <a href="${escapeHtml(staffLink)}" style="color:#005696;">${escapeHtml(staffLink)}</a></p>
`.trim();

    void sendTransactionalMail({
      to: email,
      subject: `SDS assignment: ${args.activityName}`,
      html: brandEmailWrapper(inner),
    });
  } catch (e) {
    console.error('sds assignment email failed', e);
  }
}
