import { query } from '@/lib/db';

let ensured = false;

export async function ensureStaffReportsRfColumns(): Promise<void> {
  if (ensured) return;

  const alters = [
    `ALTER TABLE staff_reports ADD COLUMN performance_status ENUM('underperformance', 'achievement', 'overachievement') NULL AFTER kpi_actual_value`,
    `ALTER TABLE staff_reports ADD COLUMN outcome_reason TEXT NULL AFTER performance_status`,
    `ALTER TABLE staff_reports ADD COLUMN practice_type ENUM('existing_practice', 'innovation') NULL AFTER outcome_reason`,
  ];

  for (const sql of alters) {
    try {
      await query({ query: sql });
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code !== 'ER_DUP_FIELDNAME' && err?.errno !== 1060) {
        throw e;
      }
    }
  }

  ensured = true;
}
