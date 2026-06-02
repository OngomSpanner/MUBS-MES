import { brandEmailWrapper, escapeHtml, isSmtpConfigured, sendTransactionalMail } from '@/lib/mail';
import { normalizeRoleForCookie } from '@/lib/role-routing';

type ActivationRole = 'HOD' | 'Ambassador';

function baseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function roleToDashboardPath(role: ActivationRole): string {
  if (role === 'HOD') return '/department-head';
  return '/ambassador';
}

function roleDisplayName(role: ActivationRole): string {
  if (role === 'HOD') return 'Head of Department (HOD) / Unit Head';
  return 'Strategic Plan Ambassador';
}

function buildActivationHtml(args: { fullName: string; role: ActivationRole }): string {
  const appBase = baseUrl();
  const name = escapeHtml(args.fullName || 'Colleague');
  const roleLabel = escapeHtml(roleDisplayName(args.role));
  const loginUrl = `${appBase}/`;
  const dashboardUrl = `${appBase}${roleToDashboardPath(args.role)}`;

  return brandEmailWrapper(`
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 12px;">Hello ${name},</p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      You have been assigned the <strong>${roleLabel}</strong> role in the MUBS Strategic Plan M&amp;E System.
    </p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      Login here: <a href="${loginUrl}" style="color:#005696;text-decoration:none;">${loginUrl}</a>
    </p>
    <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 12px;">
      After login, you can access your dashboard here:
      <a href="${dashboardUrl}" style="color:#005696;text-decoration:none;">${dashboardUrl}</a>
    </p>
    <p style="color:#666;font-size:13px;line-height:1.6;margin:14px 0 0;">
      If this is your first login and you don’t know your password, please use the <strong>Forgot password</strong> option on the login page.
    </p>
  `);
}

export async function sendRoleActivationEmail(args: {
  to: string;
  fullName: string;
  role: ActivationRole;
}): Promise<{ sent: boolean; skipped: boolean }> {
  const toClean = String(args.to || '').trim();
  if (!toClean) return { sent: false, skipped: true };
  if (!isSmtpConfigured()) return { sent: false, skipped: true };

  const subject = `Role assignment: ${roleDisplayName(args.role)}`;
  const html = buildActivationHtml({ fullName: args.fullName, role: args.role });

  const sent = await sendTransactionalMail({
    to: toClean,
    subject,
    html,
  });
  return { sent, skipped: !sent };
}

export function extractActivationRolesFromRoleField(roleField: string): ActivationRole[] {
  const roles = (roleField || '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => normalizeRoleForCookie(r));

  const out: ActivationRole[] = [];
  if (roles.includes('HOD')) out.push('HOD');
  if (roles.includes('Ambassador')) out.push('Ambassador');
  return out;
}

