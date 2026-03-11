export type UserRole =
  | 'System Administrator'
  | 'Strategy Manager'
  | 'Committee Member'
  | 'Principal'
  | 'Department Head'
  | 'Unit Head'
  | 'HOD'
  | 'Staff'
  | 'Viewer'
  | (string & {});

export function parseRoles(roleField: unknown): string[] {
  if (typeof roleField !== 'string') return [];
  return roleField
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
}

/**
 * Picks the default active role after login.
 *
 * Priority (highest → lowest):
 * - System Administrator / Strategy Manager → /admin
 * - Committee Member → /comm
 * - Principal → /principal
 * - Department Head / Unit Head / HOD → /department-head
 * - Staff / Viewer → /staff
 * - fallback: Staff
 */
export function pickDefaultActiveRole(roles: string[]): string {
  const normalized = roles.map((r) => normalizeRoleForCookie(r));
  if (normalized.includes('System Administrator')) return 'System Administrator';
  if (normalized.includes('Strategy Manager')) return 'Strategy Manager';
  if (normalized.includes('Committee Member')) return 'Committee Member';
  if (normalized.includes('Principal')) return 'Principal';
  if (normalized.includes('Department Head')) return 'Department Head';
  if (normalized.includes('Unit Head')) return 'Unit Head';
  if (normalized.includes('HOD')) return 'HOD';
  if (normalized.includes('Staff')) return 'Staff';
  if (normalized.includes('Viewer')) return 'Viewer';
  return 'Staff';
}

export function dashboardPathForRole(role: string | undefined): '/admin' | '/comm' | '/principal' | '/department-head' | '/staff' {
  if (role === 'System Administrator' || role === 'Strategy Manager') return '/admin';
  if (role === 'Committee Member') return '/comm';
  if (role === 'Principal') return '/principal';
  if (role === 'Department Head' || role === 'Unit Head' || role === 'HOD') return '/department-head';
  return '/staff';
}

/** Canonical role strings that middleware and routeRequirements expect. */
const CANONICAL_ROLES = [
  'System Administrator',
  'Strategy Manager',
  'Committee Member',
  'Principal',
  'Department Head',
  'Unit Head',
  'HOD',
  'Staff',
  'Viewer',
] as const;

/** Map snake_case (from DB) to canonical form. */
const SNAKE_TO_CANONICAL: Record<string, string> = {
  system_admin: 'System Administrator',
  strategy_manager: 'Strategy Manager',
  committee_member: 'Committee Member',
  principal: 'Principal',
  department_head: 'Department Head',
  unit_head: 'Unit Head',
  hod: 'HOD',
  staff: 'Staff',
  viewer: 'Viewer',
};

/**
 * Maps a role string (e.g. from DB or frontend) to the canonical form used in cookies and middleware.
 * Accepts both "Committee Member" and "committee_member".
 */
export function normalizeRoleForCookie(role: string | undefined): string {
  if (!role || typeof role !== 'string') return 'Staff';
  const r = role.trim();
  if (!r) return 'Staff';
  const lower = r.toLowerCase();
  const fromSnake = SNAKE_TO_CANONICAL[lower];
  if (fromSnake) return fromSnake;
  const found = CANONICAL_ROLES.find((c) => c.toLowerCase() === lower);
  return found ?? 'Staff';
}

/** Check if a role string matches one of the user's roles (case-insensitive). */
export function roleMatches(userRoles: string[], selectedRole: string): boolean {
  const s = selectedRole.trim().toLowerCase();
  return userRoles.some((r) => r.trim().toLowerCase() === s);
}

/** Get the canonical role from user's list that matches the selected role. */
export function getCanonicalRole(userRoles: string[], selectedRole: string): string {
  const s = selectedRole.trim().toLowerCase();
  const found = userRoles.find((r) => r.trim().toLowerCase() === s);
  return normalizeRoleForCookie(found ?? selectedRole);
}

/**
 * Human-readable label for a role (for UI display).
 * Handles snake_case from DB: strategy_manager → "Strategy Manager", hod → "Head of Department".
 */
export function formatRoleForDisplay(role: string | undefined): string {
  if (!role || typeof role !== 'string') return 'Staff';
  const canonical = normalizeRoleForCookie(role);
  if (canonical === 'HOD') return 'Head of Department';
  return canonical;
}

