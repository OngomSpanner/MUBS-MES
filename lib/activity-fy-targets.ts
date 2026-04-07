/** Strategic activity columns: numeric targets per Uganda financial year (Jul–Jun). */

export const ACTIVITY_FY_TARGET_COLUMNS = [
  { key: 'target_fy25_26', label: 'FY 2025/26' },
  { key: 'target_fy26_27', label: 'FY 2026/27' },
  { key: 'target_fy27_28', label: 'FY 2027/28' },
  { key: 'target_fy28_29', label: 'FY 2028/29' },
  { key: 'target_fy29_30', label: 'FY 2029/30' },
] as const;

export type ActivityFyTargetKey = (typeof ACTIVITY_FY_TARGET_COLUMNS)[number]['key'];

export function fyInputFromRow(
  row: Partial<Record<ActivityFyTargetKey, string | number | null | undefined>>
): Record<ActivityFyTargetKey, string> {
  const out = {} as Record<ActivityFyTargetKey, string>;
  for (const { key } of ACTIVITY_FY_TARGET_COLUMNS) {
    const v = row[key];
    if (v == null || v === '') out[key] = '';
    else out[key] = String(v);
  }
  return out;
}

export function parseFyPayload(
  fields: Record<ActivityFyTargetKey, string>
): Record<ActivityFyTargetKey, number | null> {
  const out = {} as Record<ActivityFyTargetKey, number | null>;
  for (const { key } of ACTIVITY_FY_TARGET_COLUMNS) {
    const raw = (fields[key] ?? '').trim();
    if (raw === '') {
      out[key] = null;
      continue;
    }
    const n = Number(raw);
    out[key] = Number.isFinite(n) ? n : null;
  }
  return out;
}
