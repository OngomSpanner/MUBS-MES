import { query } from '@/lib/db';

const ORDER_CLAUSE = 'ORDER BY standard_id, step_order ASC, id ASC';

const NULL_DURATION = { duration_value: null, duration_unit: null };
let ensuredDurationColumns = false;

export async function ensureStandardProcessDurationColumns(): Promise<void> {
  if (ensuredDurationColumns) return;
  try {
    await query({
      query: 'ALTER TABLE standard_processes ADD COLUMN duration_value INT NULL DEFAULT NULL',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  try {
    await query({
      query: 'ALTER TABLE standard_processes ADD COLUMN duration_unit VARCHAR(20) NULL DEFAULT NULL',
    });
  } catch (e: unknown) {
    const err = e as { errno?: number };
    if (err.errno !== 1060) throw e;
  }
  ensuredDurationColumns = true;
}

function withDefaults(
  rows: Record<string, unknown>[],
  defaults: Record<string, unknown>
): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r, ...defaults }));
}

export async function selectStandardProcessesAll(): Promise<Record<string, unknown>[]> {
  try {
    return (await query({
      query: `SELECT id, standard_id, step_name, step_order, duration_value, duration_unit FROM standard_processes ${ORDER_CLAUSE}`,
    })) as Record<string, unknown>[];
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number };
    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
      try {
        return (await query({
          query: `SELECT id, standard_id, step_name, step_order FROM standard_processes ${ORDER_CLAUSE}`,
        })) as Record<string, unknown>[];
      } catch (e2: unknown) {
        const err2 = e2 as { code?: string; errno?: number };
        if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
          const rows = (await query({
            query: `SELECT id, standard_id, step_name, step_order FROM standard_processes ${ORDER_CLAUSE}`,
          })) as Record<string, unknown>[];
          return withDefaults(rows, { ...NULL_DURATION });
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function selectStandardProcessesForStandard(standardId: string | number): Promise<Record<string, unknown>[]> {
  try {
    return (await query({
      query: `SELECT id, standard_id, step_name, step_order, duration_value, duration_unit FROM standard_processes WHERE standard_id = ? ORDER BY step_order ASC`,
      values: [standardId],
    })) as Record<string, unknown>[];
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number };
    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
      try {
        return (await query({
          query: `SELECT id, standard_id, step_name, step_order FROM standard_processes WHERE standard_id = ? ORDER BY step_order ASC`,
          values: [standardId],
        })) as Record<string, unknown>[];
      } catch (e2: unknown) {
        const err2 = e2 as { code?: string; errno?: number };
        if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
          const rows = (await query({
            query: `SELECT id, standard_id, step_name, step_order FROM standard_processes WHERE standard_id = ? ORDER BY step_order ASC`,
            values: [standardId],
          })) as Record<string, unknown>[];
          return withDefaults(rows, { ...NULL_DURATION });
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function insertStandardProcessRow(
  standardId: number,
  stepName: string,
  stepOrder: number,
  durationValue: number | null,
  durationUnit: string | null
): Promise<void> {
  try {
    await ensureStandardProcessDurationColumns();
    await query({
      query: `INSERT INTO standard_processes (standard_id, step_name, step_order, duration_value, duration_unit) VALUES (?, ?, ?, ?, ?)`,
      values: [standardId, stepName, stepOrder, durationValue, durationUnit],
    });
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number };
    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
      await query({
        query: `INSERT INTO standard_processes (standard_id, step_name, step_order) VALUES (?, ?, ?)`,
        values: [standardId, stepName, stepOrder],
      });
    } else {
      throw e;
    }
  }
}
