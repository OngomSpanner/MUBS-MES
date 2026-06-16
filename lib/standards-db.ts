import { query } from '@/lib/db';
import {
  buildStandardsSelectSql,
  emptySdsFields,
  parseStandardSdsFromBody,
  sdsFieldsFromRow,
  type StandardSdsPayload,
} from '@/lib/standard-sds-fields';

const LEGACY_SELECT = `id, title, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, target, created_at`;

function isMissingColumnError(e: unknown): boolean {
  const err = e as { code?: string; errno?: number };
  return err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054;
}

function withEmptySds(row: Record<string, unknown>): Record<string, unknown> {
  const empty = emptySdsFields();
  return {
    ...row,
    standard_no: empty.standard_no,
    user_fee: empty.user_fee,
    standard_owner: empty.standard_owner,
    supporting_units: empty.supporting_units,
    pathway: empty.pathway,
    process_standard: empty.process_standard,
    time_standard: empty.time_standard,
    accessibility: empty.accessibility,
    coverage: empty.coverage,
    frequency: empty.frequency,
    target_beneficiary: empty.target_beneficiary,
    access_criteria: empty.access_criteria,
    methodology: empty.methodology,
    inputs: empty.inputs,
    performance_indicators: null,
  };
}

export async function selectAllStandardsRows(): Promise<Record<string, unknown>[]> {
  try {
    return (await query({
      query: `SELECT ${buildStandardsSelectSql()} FROM standards ORDER BY created_at DESC`,
    })) as Record<string, unknown>[];
  } catch (e: unknown) {
    if (!isMissingColumnError(e)) throw e;
    try {
      const rows = (await query({
        query: `SELECT ${LEGACY_SELECT} FROM standards ORDER BY created_at DESC`,
      })) as Record<string, unknown>[];
      return rows.map(withEmptySds);
    } catch (e2: unknown) {
      if (!isMissingColumnError(e2)) throw e2;
      const rows = (await query({
        query: `SELECT id, title, quality_standard, output_standard, target, created_at FROM standards ORDER BY created_at DESC`,
      })) as Record<string, unknown>[];
      return rows.map((r) =>
        withEmptySds({
          ...r,
          performance_indicator: null,
          duration_value: null,
          duration_unit: null,
        })
      );
    }
  }
}

export async function selectStandardRowById(id: string | number): Promise<Record<string, unknown> | null> {
  try {
    const rows = (await query({
      query: `SELECT ${buildStandardsSelectSql()} FROM standards WHERE id = ?`,
      values: [id],
    })) as Record<string, unknown>[];
    return rows[0] ?? null;
  } catch (e: unknown) {
    if (!isMissingColumnError(e)) throw e;
    try {
      const rows = (await query({
        query: `SELECT ${LEGACY_SELECT} FROM standards WHERE id = ?`,
        values: [id],
      })) as Record<string, unknown>[];
      const row = rows[0];
      return row ? withEmptySds(row) : null;
    } catch (e2: unknown) {
      if (!isMissingColumnError(e2)) throw e2;
      const rows = (await query({
        query: `SELECT id, title, quality_standard, output_standard, target, created_at FROM standards WHERE id = ?`,
        values: [id],
      })) as Record<string, unknown>[];
      const row = rows[0];
      return row
        ? withEmptySds({
            ...row,
            performance_indicator: null,
            duration_value: null,
            duration_unit: null,
          })
        : null;
    }
  }
}

export type ParsedStandardWrite = ReturnType<typeof parseStandardSdsFromBody>;

export function validateStandardWritePayload(parsed: ParsedStandardWrite): string | null {
  if (!parsed.standard_no) return 'Standard No. is required.';
  if (!parsed.title) return 'Standard title is required.';
  if (!parsed.standard_owner) return 'Standard owner is required.';
  if (!parsed.output_standard) return 'Output standard is required.';
  if (parsed.performance_indicators.length === 0) return 'At least one performance indicator is required.';
  const unit = parsed.duration_unit;
  const dv = parsed.duration_value;
  if ((unit && (dv == null || !Number.isFinite(dv) || dv < 1)) || (!unit && dv != null)) {
    return 'If provided, standard duration must include both unit and value (>= 1).';
  }
  return null;
}

function sdsInsertValues(parsed: ParsedStandardWrite): unknown[] {
  return [
    parsed.title,
    parsed.standard_no,
    parsed.user_fee,
    parsed.standard_owner || null,
    parsed.supporting_units,
    parsed.pathway,
    parsed.quality_standard || null,
    parsed.output_standard,
    parsed.performance_indicator,
    JSON.stringify(parsed.performance_indicators),
    parsed.process_standard,
    parsed.time_standard,
    parsed.accessibility,
    parsed.coverage,
    parsed.frequency,
    parsed.target_beneficiary,
    parsed.access_criteria,
    parsed.methodology,
    parsed.inputs,
    parsed.duration_value,
    parsed.duration_unit || null,
    null,
  ];
}

export async function insertStandardRow(parsed: ParsedStandardWrite): Promise<{ insertId: number }> {
  try {
    const result = await query({
      query: `INSERT INTO standards (
        title, standard_no, user_fee, standard_owner, supporting_units, pathway,
        quality_standard, output_standard, performance_indicator, performance_indicators,
        process_standard, time_standard, accessibility, coverage, frequency,
        target_beneficiary, access_criteria, methodology, inputs,
        duration_value, duration_unit, target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: sdsInsertValues(parsed),
    });
    const insertId = Number((result as { insertId?: number | bigint }).insertId);
    if (!Number.isFinite(insertId) || insertId <= 0) {
      throw new Error('Missing insertId');
    }
    return { insertId };
  } catch (e: unknown) {
    if (!isMissingColumnError(e)) throw e;
    const result = await query({
      query: `INSERT INTO standards (
        title, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, target
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        parsed.title,
        parsed.quality_standard || null,
        parsed.output_standard,
        parsed.performance_indicator,
        parsed.duration_value,
        parsed.duration_unit || null,
        null,
      ],
    });
    const insertId = Number((result as { insertId?: number | bigint }).insertId);
    if (!Number.isFinite(insertId) || insertId <= 0) {
      throw new Error('Missing insertId');
    }
    return { insertId };
  }
}

export async function updateStandardRow(id: string | number, parsed: ParsedStandardWrite): Promise<void> {
  try {
    await query({
      query: `UPDATE standards SET
        title = ?, standard_no = ?, user_fee = ?, standard_owner = ?, supporting_units = ?, pathway = ?,
        quality_standard = ?, output_standard = ?, performance_indicator = ?, performance_indicators = ?,
        process_standard = ?, time_standard = ?, accessibility = ?, coverage = ?, frequency = ?,
        target_beneficiary = ?, access_criteria = ?, methodology = ?, inputs = ?,
        duration_value = ?, duration_unit = ?, target = ?
        WHERE id = ?`,
      values: [...sdsInsertValues(parsed), id],
    });
  } catch (e: unknown) {
    if (!isMissingColumnError(e)) throw e;
    await query({
      query: `UPDATE standards SET
        title = ?, quality_standard = ?, output_standard = ?, performance_indicator = ?,
        duration_value = ?, duration_unit = ?, target = ?
        WHERE id = ?`,
      values: [
        parsed.title,
        parsed.quality_standard || null,
        parsed.output_standard,
        parsed.performance_indicator,
        parsed.duration_value,
        parsed.duration_unit || null,
        null,
        id,
      ],
    });
  }
}

export { parseStandardSdsFromBody, sdsFieldsFromRow };
export type { StandardSdsPayload };
