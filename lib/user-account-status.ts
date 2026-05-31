/** Login account status stored in users.status */

export const USER_ACCOUNT_STATUSES = ['Active', 'Pending', 'Suspended'] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export const DEFAULT_USER_ACCOUNT_STATUS: UserAccountStatus = 'Active';

export function normalizeUserAccountStatus(
  value: unknown,
  fallback: UserAccountStatus = DEFAULT_USER_ACCOUNT_STATUS
): UserAccountStatus {
  const s = value != null ? String(value).trim() : '';
  if (s === 'Active' || s === 'Pending' || s === 'Suspended') return s;
  return fallback;
}
