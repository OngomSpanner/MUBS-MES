/** Build WHERE fragment for users eligible for HR update sync */
export function buildChangedUsersWhere(onlyChanged: boolean, changedSinceDays: number): string {
  if (!onlyChanged) {
    return 'email IS NOT NULL AND TRIM(email) != \'\'';
  }
  const days = Math.max(parseInt(String(changedSinceDays), 10) || 0, 0);
  if (days === 0) {
    return `email IS NOT NULL AND TRIM(email) != ''
      AND hrms_last_synced_at IS NULL`;
  }
  return `email IS NOT NULL AND TRIM(email) != ''
    AND (
      hrms_last_synced_at IS NULL
      OR hrms_last_synced_at < DATE_SUB(NOW(), INTERVAL ${days} DAY)
    )`;
}
