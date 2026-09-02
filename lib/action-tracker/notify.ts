import { brandEmailWrapper, escapeHtml, sendTransactionalMail } from '@/lib/mail';
import { insertAppNotification } from '@/lib/notifications';
import { query } from '@/lib/db';

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'https://mubsme.mubs.ac.ug').replace(
    /\/$/,
    '',
  );
}

export async function notifyActionAssigned(args: {
  userId: number;
  actionId: number;
  title: string;
  teamName: string;
  deadline: string | null;
  assignedBy: string;
}): Promise<void> {
  const staffLink = `${appBaseUrl()}/staff?pg=action-tracker`;
  const deadline = args.deadline ? String(args.deadline).slice(0, 10) : 'Not set';
  const title = 'Committee action assigned';
  const message = `You have been assigned “${args.title}” under ${args.teamName}. Deadline: ${deadline}. Assigned by ${args.assignedBy}.`;

  try {
    await insertAppNotification({
      userId: args.userId,
      title,
      message,
      type: 'info',
      relatedEntityType: 'action_item',
      relatedEntityId: args.actionId,
      actionUrl: '/staff?pg=action-tracker',
    });
  } catch (e) {
    console.error('action-tracker in-app notify failed', e);
  }

  try {
    const users = (await query({
      query: 'SELECT email, full_name FROM users WHERE id = ? LIMIT 1',
      values: [args.userId],
    })) as { email: string | null; full_name: string | null }[];
    const email = String(users[0]?.email || '').trim();
    const name = String(users[0]?.full_name || 'Colleague').trim();
    if (!email) return;

    const inner = `
<p style="color:#333333;font-size:16px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
<p style="color:#333333;font-size:16px;line-height:1.6;">
  An action from <strong>${escapeHtml(args.teamName)}</strong> has been assigned to you.
</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#333;">
  <tr><td style="padding:8px 0;color:#666;width:140px;">Action</td><td style="padding:8px 0;"><strong>${escapeHtml(args.title)}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666;">Deadline</td><td style="padding:8px 0;"><strong>${escapeHtml(deadline)}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666;">Assigned by</td><td style="padding:8px 0;">${escapeHtml(args.assignedBy)}</td></tr>
</table>
<p style="text-align:center;margin:28px 0;">
  <a href="${escapeHtml(staffLink)}"
     style="background:#005696;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:bold;">
    Open Action Tracker
  </a>
</p>`.trim();

    await sendTransactionalMail({
      to: email,
      subject: `Action assigned: ${args.title}`,
      html: brandEmailWrapper(inner),
    });
  } catch (e) {
    console.error('action-tracker email notify failed', e);
  }
}
