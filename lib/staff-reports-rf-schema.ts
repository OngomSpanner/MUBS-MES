import { query } from '@/lib/db';
import { columnExists } from '@/lib/db-schema';

let ensured = false;

const STAFF_REPORT_RF_COLUMNS: { name: string; sql: string }[] = [
  {
    name: 'performance_status',
    sql: `ALTER TABLE staff_reports ADD COLUMN performance_status ENUM('underperformance', 'achievement', 'overachievement') NULL AFTER kpi_actual_value`,
  },
  {
    name: 'outcome_reason',
    sql: 'ALTER TABLE staff_reports ADD COLUMN outcome_reason TEXT NULL AFTER performance_status',
  },
  {
    name: 'practice_type',
    sql: `ALTER TABLE staff_reports ADD COLUMN practice_type ENUM('existing_practice', 'innovation') NULL AFTER outcome_reason`,
  },
];

export async function ensureStaffReportsRfColumns(): Promise<void> {
  if (ensured) return;

  for (const col of STAFF_REPORT_RF_COLUMNS) {
    if (!(await columnExists('staff_reports', col.name))) {
      await query({ query: col.sql });
    }
  }

  ensured = true;
}
