import { query } from '@/lib/db';

let schemaEnsured = false;

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    values: [table, column],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

/** Idempotent: link questionnaire outcomes/outputs to strategic plan objectives. */
export async function ensureQuestionnaireObjectiveSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!(await columnExists('q_outcomes', 'strategic_objective'))) {
    await query({
      query: `
        ALTER TABLE q_outcomes
        ADD COLUMN strategic_objective VARCHAR(512) NULL AFTER label,
        ADD KEY idx_q_outcomes_objective (strategic_objective(191))
      `,
    });
  }
  schemaEnsured = true;
}
