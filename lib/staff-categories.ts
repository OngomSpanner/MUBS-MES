/**
 * Staff categories for user employment records.
 * Keep dropdowns and API validation aligned with this list.
 */
export const STAFF_CATEGORIES = ['Academic', 'Administrative', 'Support'] as const;
export type StaffCategory = (typeof STAFF_CATEGORIES)[number];

export function isStaffCategory(s: string | null | undefined): s is StaffCategory {
  return !!s && (STAFF_CATEGORIES as readonly string[]).includes(s);
}

export function normalizeStaffCategory(
  s: string | null | undefined
): StaffCategory | null {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  return isStaffCategory(t) ? t : null;
}
