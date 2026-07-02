import { query } from '@/lib/db';

let schemaEnsured = false;

async function tableExists(table: string): Promise<boolean> {
  const rows = (await query({
    query: `SELECT COUNT(*) AS c FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    values: [table],
  })) as { c: number }[];
  return Number(rows[0]?.c) > 0;
}

/** Idempotent schema for optional ambassador notes per metric. */
export async function ensureMetricCommentsSchema(): Promise<void> {
  if (schemaEnsured) return;

  if (!(await tableExists('q_metric_comments'))) {
    await query({
      query: `
        CREATE TABLE q_metric_comments (
          metric_id INT NOT NULL,
          department_id INT NOT NULL,
          indicator_id INT NOT NULL,
          comment TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (metric_id, department_id),
          KEY idx_qmc_indicator_dept (indicator_id, department_id)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4
      `,
    });
  }

  schemaEnsured = true;
}

export type MetricCommentRow = {
  metric_id: number;
  comment: string | null;
};
