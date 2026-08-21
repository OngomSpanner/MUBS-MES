import { query } from '@/lib/db';
import {
  parseResultOperation,
  type ResultFormulaOperand,
  type ResultOperation,
} from '@/lib/questionnaire/result-formulas-constants';

export {
  RESULT_OPERATIONS,
  RESULT_OPERATION_LABELS,
  parseResultOperation,
  type ResultFormulaOperand,
  type ResultOperation,
} from '@/lib/questionnaire/result-formulas-constants';

export type ResultFormulaRow = {
  id: number;
  name: string;
  operation: ResultOperation;
  operands: ResultFormulaOperand[];
  compareIndicatorId: number | null;
};

let schemaEnsured = false;

async function tableExists(table: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    values: [table],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

export async function ensureResultFormulasSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!(await tableExists('q_result_formulas'))) {
    await query({
      query: `
        CREATE TABLE q_result_formulas (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(512) NOT NULL,
          operation VARCHAR(32) NOT NULL,
          operands_json TEXT NOT NULL,
          compare_indicator_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
      `,
    });
  }
  schemaEnsured = true;
}

function parseOperands(raw: unknown): ResultFormulaOperand[] {
  if (!Array.isArray(raw)) return [];
  const out: ResultFormulaOperand[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const indicatorId = Number((row as ResultFormulaOperand).indicatorId);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) continue;
    const metricRaw = (row as ResultFormulaOperand).metricId;
    const metricId =
      metricRaw == null || metricRaw === ('' as unknown)
        ? null
        : Number(metricRaw);
    out.push({
      indicatorId,
      metricId: metricId != null && Number.isFinite(metricId) && metricId > 0 ? metricId : null,
    });
  }
  return out;
}

export async function listResultFormulas(): Promise<ResultFormulaRow[]> {
  await ensureResultFormulasSchema();
  const rows = (await query({
    query: `SELECT id, name, operation, operands_json, compare_indicator_id
            FROM q_result_formulas ORDER BY id`,
  })) as {
    id: number;
    name: string;
    operation: string;
    operands_json: string;
    compare_indicator_id: number | null;
  }[];

  return rows.map((r) => {
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(r.operands_json || '[]');
    } catch {
      parsed = [];
    }
    const operation = parseResultOperation(r.operation) ?? 'sum';
    return {
      id: Number(r.id),
      name: String(r.name || '').trim() || 'Untitled formula',
      operation,
      operands: parseOperands(parsed),
      compareIndicatorId: r.compare_indicator_id != null ? Number(r.compare_indicator_id) : null,
    };
  });
}

export async function insertResultFormula(input: {
  name: string;
  operation: ResultOperation;
  operands: ResultFormulaOperand[];
  compareIndicatorId?: number | null;
}): Promise<number> {
  await ensureResultFormulasSchema();
  const res = (await query({
    query: `INSERT INTO q_result_formulas (name, operation, operands_json, compare_indicator_id)
            VALUES (?, ?, ?, ?)`,
    values: [
      input.name,
      input.operation,
      JSON.stringify(input.operands),
      input.compareIndicatorId ?? null,
    ],
  })) as { insertId?: number };
  return Number(res.insertId ?? 0);
}

export async function deleteResultFormula(id: number): Promise<void> {
  await ensureResultFormulasSchema();
  await query({ query: 'DELETE FROM q_result_formulas WHERE id=?', values: [id] });
}
