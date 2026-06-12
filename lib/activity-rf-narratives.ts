import { query } from '@/lib/db';
import { isPracticeType, type PracticeType } from '@/lib/results-framework';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';

let ensured = false;

export async function ensureActivityRfNarrativesTable(): Promise<void> {
  if (ensured) return;
  await query({
    query: `
      CREATE TABLE IF NOT EXISTS activity_rf_narratives (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        activity_id INT NOT NULL,
        financial_year_key VARCHAR(16) NOT NULL,
        outcome_reason TEXT NULL,
        practice_type ENUM('existing_practice', 'innovation') NULL,
        recorded_by INT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_activity_rf_narrative_fy (activity_id, financial_year_key),
        KEY idx_activity_rf_narrative_user (recorded_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });
  ensured = true;
}

export type ActivityRfNarrative = {
  activityId: number;
  financialYearKey: string;
  outcomeReason: string | null;
  practiceType: PracticeType | null;
  recordedBy: number;
  updatedAt: string | null;
};

export async function getActivityRfNarrative(
  activityId: number,
  financialYearKey: string = fyLabelForDateJulyJune()
): Promise<ActivityRfNarrative | null> {
  await ensureActivityRfNarrativesTable();
  const rows = (await query({
    query: `
      SELECT activity_id, financial_year_key, outcome_reason, practice_type, recorded_by, updated_at
      FROM activity_rf_narratives
      WHERE activity_id = ? AND financial_year_key = ?
      LIMIT 1
    `,
    values: [activityId, financialYearKey],
  })) as {
    activity_id: number;
    financial_year_key: string;
    outcome_reason: string | null;
    practice_type: PracticeType | null;
    recorded_by: number;
    updated_at: string | null;
  }[];

  const r = rows[0];
  if (!r) return null;
  return {
    activityId: r.activity_id,
    financialYearKey: r.financial_year_key,
    outcomeReason: r.outcome_reason,
    practiceType: r.practice_type,
    recordedBy: r.recorded_by,
    updatedAt: r.updated_at,
  };
}

export async function upsertActivityRfNarrative(input: {
  activityId: number;
  userId: number;
  outcomeReason: string;
  practiceType: PracticeType | null;
  financialYearKey?: string;
}): Promise<void> {
  await ensureActivityRfNarrativesTable();
  const fy = input.financialYearKey ?? fyLabelForDateJulyJune();
  const reason = String(input.outcomeReason || '').trim();
  if (!reason || reason.length < 10) {
    throw new Error('Outcome explanation must be at least 10 characters.');
  }

  await query({
    query: `
      INSERT INTO activity_rf_narratives
        (activity_id, financial_year_key, outcome_reason, practice_type, recorded_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        outcome_reason = VALUES(outcome_reason),
        practice_type = VALUES(practice_type),
        recorded_by = VALUES(recorded_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    values: [input.activityId, fy, reason, input.practiceType, input.userId],
  });
}

export function validateNarrativeForStatus(
  performanceStatus: string | null,
  outcomeReason: string,
  practiceType: string | null
): string | null {
  const reason = outcomeReason.trim();
  if (!reason || reason.length < 10) {
    return 'Please explain the outcome (at least 10 characters).';
  }
  if (
    performanceStatus === 'achievement' ||
    performanceStatus === 'overachievement'
  ) {
    if (!practiceType || !isPracticeType(practiceType)) {
      return 'Please indicate existing practice or new innovation.';
    }
  }
  return null;
}
