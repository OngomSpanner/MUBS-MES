import { query } from '@/lib/db';

export {
  HOD_REVIEW_STATUSES,
  HOD_REVIEW_STATUS_LABELS,
  hodStatusForAmbassadorSave,
  isHodReviewStatus,
  parseSubmitForReview,
  sqlAdminApprovedOnly,
  type HodReviewStatus,
} from '@/lib/hod-review-workflow-constants';

let schemaEnsured = false;

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    values: [table, column],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    values: [table],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

/** Idempotent schema for HOD approval workflow on ambassador reporting tables. */
export async function ensureHodReviewWorkflowSchema(): Promise<void> {
  if (schemaEnsured) return;

  const tablesWithStatus = [
    'staff_benefit_entries',
    'staff_workforce_assessment_counts',
    'staff_employment_skill_status',
    'staff_programme_enrollment',
    'staff_course_unit_enrollment',
    'activity_rf_narratives',
  ];

  for (const table of tablesWithStatus) {
    if (!(await tableExists(table))) continue;
    if (await columnExists(table, 'hod_review_status')) continue;
    await query({
      query: `
        ALTER TABLE ${table}
        ADD COLUMN hod_review_status ENUM('draft','submitted','approved','returned') NOT NULL DEFAULT 'approved',
        ADD COLUMN hod_reviewed_by INT NULL,
        ADD COLUMN hod_reviewed_at TIMESTAMP NULL,
        ADD COLUMN hod_review_comment TEXT NULL
      `,
    });
  }

  if (!(await tableExists('q_indicator_submissions'))) {
    await query({
      query: `
        CREATE TABLE q_indicator_submissions (
          indicator_id INT NOT NULL,
          department_id INT NOT NULL,
          hod_review_status ENUM('draft','submitted','approved','returned') NOT NULL DEFAULT 'draft',
          submitted_by INT NULL,
          submitted_at TIMESTAMP NULL,
          hod_reviewed_by INT NULL,
          hod_reviewed_at TIMESTAMP NULL,
          hod_review_comment TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (indicator_id, department_id),
          KEY idx_q_ind_sub_status (hod_review_status),
          KEY idx_q_ind_sub_indicator (indicator_id),
          KEY idx_q_ind_sub_department (department_id)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
      `,
    });
  }

  schemaEnsured = true;
}
