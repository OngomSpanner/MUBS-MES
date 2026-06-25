import { query } from '@/lib/db';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { normalizeRoleForCookie, parseRoles } from '@/lib/role-routing';

const REVIEWER_ROLES = new Set(['HOD']);

export type HodRecipient = {
  userId: number;
  email: string;
  fullName: string;
};

/** Active HOD / unit heads who can see the given department. */
export async function getHodRecipientsForDepartment(departmentId: number | null): Promise<HodRecipient[]> {
  if (departmentId == null) return [];

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
        WHERE role IN ('department_head', 'unit_head', 'hod')
      `,
    })) as { user_id: number; role: string }[];

    for (const row of roleRows) {
      const list = rolesByUserId.get(row.user_id) ?? [];
      list.push(row.role);
      rolesByUserId.set(row.user_id, list);
    }
  } catch {
    // user_roles may not exist on older installs
  }

  const byUserId = new Map<number, HodRecipient>();

  for (const user of candidates) {
    const roles = new Set<string>();
    for (const role of parseRoles(user.role)) {
      roles.add(normalizeRoleForCookie(role));
    }
    for (const role of rolesByUserId.get(user.id) ?? []) {
      roles.add(normalizeRoleForCookie(role));
    }

    const isReviewer = [...roles].some((role) => REVIEWER_ROLES.has(role));
    if (!isReviewer) continue;

    const visibleDepartmentIds = await getVisibleDepartmentIds(user.id);
    if (!visibleDepartmentIds.includes(departmentId)) continue;

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
