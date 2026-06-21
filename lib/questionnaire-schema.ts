import { query } from '@/lib/db';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    values: [table, column],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

function isDuplicateSchemaError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_FIELDNAME' || code === 'ER_DUP_KEYNAME';
}

async function runQuestionnaireObjectiveMigration(): Promise<void> {
  if (!(await columnExists('q_outcomes', 'strategic_objective'))) {
    try {
      await query({
        query: `
          ALTER TABLE q_outcomes
          ADD COLUMN strategic_objective VARCHAR(512) NULL AFTER label
        `,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }

  try {
    await query({
      query: `
        ALTER TABLE q_outcomes
        ADD KEY idx_q_outcomes_objective (strategic_objective(191))
      `,
    });
  } catch (error) {
    if (!isDuplicateSchemaError(error)) throw error;
  }

  schemaEnsured = true;
}

/** Idempotent: link questionnaire outcomes/outputs to strategic plan objectives. */
export async function ensureQuestionnaireObjectiveSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!ensurePromise) {
    ensurePromise = runQuestionnaireObjectiveMigration().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}
