import { query } from '@/lib/db';
import { normalizeRoleForCookie, parseRoles } from '@/lib/role-routing';

const ADMIN_ROLES = new Set(['System Administrator', 'Strategy Manager']);

export type AdminStrategyRecipient = {
  userId: number;
  email: string;
  fullName: string;
};

/** Active System Administrators and Strategy Managers. */
export async function getAdminStrategyRecipients(): Promise<AdminStrategyRecipient[]> {
  const candidates = (await query({
    query: `
      SELECT id, full_name, email, role
      FROM users
      WHERE status = 'Active'
        AND email IS NOT NULL
        AND TRIM(email) <> ''
    `,
  })) as { id: number; full_name: string | null; email: string; role: string | null }[];

  const rolesByUserId = new Map<number, string[]>();
  try {
    const roleRows = (await query({
      query: `
        SELECT user_id, role
        FROM user_roles
        WHERE role IN ('system_admin', 'strategy_manager', 'system administrator', 'strategy manager')
      `,
    })) as { user_id: number; role: string }[];

    for (const row of roleRows) {
      const list = rolesByUserId.get(row.user_id) ?? [];
      list.push(row.role);
      rolesByUserId.set(row.user_id, list);
    }
  } catch {
    // user_roles may not exist
  }

  const byUserId = new Map<number, AdminStrategyRecipient>();

  for (const user of candidates) {
    const roles = new Set<string>();
    for (const role of parseRoles(user.role)) {
      roles.add(normalizeRoleForCookie(role));
    }
    for (const role of rolesByUserId.get(user.id) ?? []) {
      roles.add(normalizeRoleForCookie(role));
    }

    const isAdmin = [...roles].some((role) => ADMIN_ROLES.has(role));
    if (!isAdmin) continue;

    if (!byUserId.has(user.id)) {
      byUserId.set(user.id, {
        userId: user.id,
        email: String(user.email).trim(),
        fullName: String(user.full_name || '').trim() || 'Colleague',
      });
    }
  }

  return [...byUserId.values()];
}
