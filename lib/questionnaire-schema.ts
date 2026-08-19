import { query } from '@/lib/db';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;
/** Separate from schemaEnsured: older deploys could mark objectives “ensured” before pillar columns existed. */
let pillarSchemaEnsured = false;
let pillarEnsurePromise: Promise<void> | null = null;
let indicatorPillarSchemaEnsured = false;
let indicatorPillarEnsurePromise: Promise<void> | null = null;
let subMetricSchemaEnsured = false;
let subMetricEnsurePromise: Promise<void> | null = null;

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

export function isUnknownColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_BAD_FIELD_ERROR';
}

async function ensureMetricSubMetricSchema(): Promise<void> {
  if (subMetricSchemaEnsured) return;

  // Columns
  if (!(await columnExists('q_metrics', 'parent_metric_id'))) {
    try {
      await query({
        query: `ALTER TABLE q_metrics ADD COLUMN parent_metric_id INT NULL AFTER unit_of_measure`,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }

  if (!(await columnExists('q_metrics', 'aggregation'))) {
    try {
      await query({
        query: `ALTER TABLE q_metrics ADD COLUMN aggregation VARCHAR(32) NULL AFTER parent_metric_id`,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }

  if (!(await columnExists('q_metrics', 'is_total'))) {
    try {
      await query({
        query: `ALTER TABLE q_metrics ADD COLUMN is_total TINYINT(1) NOT NULL DEFAULT 0 AFTER aggregation`,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }

  // Indexes (safe to re-run)
  try {
    await query({
      query: `ALTER TABLE q_metrics ADD KEY idx_q_metrics_parent (parent_metric_id)`,
    });
  } catch (error) {
    if (!isDuplicateSchemaError(error)) throw error;
  }

  try {
    await query({
      query: `ALTER TABLE q_metrics ADD KEY idx_q_metrics_indicator_sort (indicator_id, sort_order)`,
    });
  } catch (error) {
    if (!isDuplicateSchemaError(error)) throw error;
  }

  subMetricSchemaEnsured = true;
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

async function runQuestionnairePillarMigration(): Promise<void> {
  // SDS-style pillar linkage on outcomes (nullable; does not touch q_responses).
  if (!(await columnExists('q_outcomes', 'strategic_pillar'))) {
    try {
      await query({
        query: `
          ALTER TABLE q_outcomes
          ADD COLUMN strategic_pillar VARCHAR(255) NULL AFTER strategic_objective
        `,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }

  if (!(await columnExists('q_outcomes', 'pillar_code'))) {
    try {
      await query({
        query: `
          ALTER TABLE q_outcomes
          ADD COLUMN pillar_code VARCHAR(16) NULL AFTER strategic_pillar
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
        ADD KEY idx_q_outcomes_pillar (strategic_pillar(191))
      `,
    });
  } catch (error) {
    if (!isDuplicateSchemaError(error)) throw error;
  }

  // Only mark done once both columns are actually present (handles races / partial ALTERs).
  pillarSchemaEnsured =
    (await columnExists('q_outcomes', 'strategic_pillar')) &&
    (await columnExists('q_outcomes', 'pillar_code'));
}

/** Idempotent: ensure q_outcomes.strategic_pillar + pillar_code exist. */
export async function ensureQuestionnairePillarColumns(): Promise<void> {
  if (pillarSchemaEnsured) return;
  if (!pillarEnsurePromise) {
    pillarEnsurePromise = runQuestionnairePillarMigration().catch((error) => {
      pillarEnsurePromise = null;
      pillarSchemaEnsured = false;
      throw error;
    });
  }
  await pillarEnsurePromise;
  if (!pillarSchemaEnsured) {
    pillarEnsurePromise = null;
    throw new Error('q_outcomes pillar columns are still missing after migration');
  }
}

async function runQuestionnaireIndicatorPillarMigration(): Promise<void> {
  if (!(await columnExists('q_indicators', 'strategic_pillar'))) {
    try {
      await query({
        query: `ALTER TABLE q_indicators ADD COLUMN strategic_pillar VARCHAR(255) NULL AFTER indicator_text`,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }
  if (!(await columnExists('q_indicators', 'pillar_code'))) {
    try {
      await query({
        query: `ALTER TABLE q_indicators ADD COLUMN pillar_code VARCHAR(16) NULL AFTER strategic_pillar`,
      });
    } catch (error) {
      if (!isDuplicateSchemaError(error)) throw error;
    }
  }
  indicatorPillarSchemaEnsured =
    (await columnExists('q_indicators', 'strategic_pillar')) &&
    (await columnExists('q_indicators', 'pillar_code'));
}

export async function ensureQuestionnaireIndicatorPillarColumns(): Promise<void> {
  if (indicatorPillarSchemaEnsured) return;
  if (!indicatorPillarEnsurePromise) {
    indicatorPillarEnsurePromise = runQuestionnaireIndicatorPillarMigration().catch((error) => {
      indicatorPillarEnsurePromise = null;
      indicatorPillarSchemaEnsured = false;
      throw error;
    });
  }
  await indicatorPillarEnsurePromise;
}

/** Idempotent: link questionnaire outcomes/outputs to strategic plan objectives + pillars. */
export async function ensureQuestionnaireObjectiveSchema(): Promise<void> {
  if (schemaEnsured && pillarSchemaEnsured && indicatorPillarSchemaEnsured) return;
  if (!schemaEnsured) {
    if (!ensurePromise) {
      ensurePromise = runQuestionnaireObjectiveMigration().catch((error) => {
        ensurePromise = null;
        throw error;
      });
    }
    await ensurePromise;
  }
  await ensureQuestionnairePillarColumns();
  await ensureQuestionnaireIndicatorPillarColumns();
}

/** Reset in-memory flags after unknown-column errors so the next request re-runs ALTER. */
export function invalidateQuestionnaireObjectiveSchemaCache(): void {
  schemaEnsured = false;
  pillarSchemaEnsured = false;
  indicatorPillarSchemaEnsured = false;
  ensurePromise = null;
  pillarEnsurePromise = null;
  indicatorPillarEnsurePromise = null;
}

export const SQL_RESOLVED_INDICATOR_PILLAR = `COALESCE(NULLIF(TRIM(i.strategic_pillar), ''), o.strategic_pillar)`;
export const SQL_RESOLVED_INDICATOR_PILLAR_CODE = `COALESCE(NULLIF(TRIM(i.pillar_code), ''), o.pillar_code)`;

/** Idempotent: allow questionnaire metrics to have sub-metrics and auto totals. */
export async function ensureQuestionnaireSubMetricsSchema(): Promise<void> {
  if (subMetricSchemaEnsured) return;
  if (!subMetricEnsurePromise) {
    subMetricEnsurePromise = ensureMetricSubMetricSchema().catch((error) => {
      subMetricEnsurePromise = null;
      throw error;
    });
  }
  await subMetricEnsurePromise;
}
