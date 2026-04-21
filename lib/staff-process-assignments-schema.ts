import { query } from '@/lib/db';

let ensuredSectionColumn = false;
let ensuredDurationColumns = false;

/** Nullable FK-style column for section-scoped assignments (ALTER may run once per deploy). */
export async function ensureStaffProcessAssignmentSectionColumn(): Promise<void> {
  if (ensuredSectionColumn) return;
  try {
    await query({
      query:
        'ALTER TABLE staff_process_assignments ADD COLUMN section_id INT NULL DEFAULT NULL',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  ensuredSectionColumn = true;
}


/** Optional per-assignment duration override set by HOD when opening a process task. */
export async function ensureStaffProcessAssignmentDurationColumns(): Promise<void> {
  if (ensuredDurationColumns) return;
  try {
    await query({
      query:
        'ALTER TABLE staff_process_assignments ADD COLUMN duration_value INT NULL DEFAULT NULL',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  try {
    await query({
      query:
        'ALTER TABLE staff_process_assignments ADD COLUMN duration_unit VARCHAR(20) NULL DEFAULT NULL',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  ensuredDurationColumns = true;
}
