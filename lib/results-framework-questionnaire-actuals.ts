export type QuestionnaireActualOptions = {
  /** When true, only HOD-approved questionnaire submissions are counted (admin / HOD reports). */
  hodApprovedOnly?: boolean;
};

/** Resolve any FY key/label to the long matrix label (e.g. 2025/26 → 2025/2026). */
export function questionnaireFyLabelFromKey(fyKey: string): string {
  const t = String(fyKey || '')
    .trim()
    .replace(/^FY\s+/i, '');
  const m = t.match(/^(\d{4})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return t;
  const y1 = parseInt(m[1], 10);
  if (!Number.isFinite(y1)) return t;
  return `${y1}/${y1 + 1}`;
}

/** Long + short FY strings stored in q_responses (e.g. 2024/2025 and 2024/25). */
export function fyStoredVariants(fyLabel: string): string[] {
  const long = String(fyLabel || '').trim().match(/^(\d{4})\/(\d{4})$/);
  if (long) {
    const y1 = long[1];
    const y2 = long[2];
    return [`${y1}/${y2}`, `${y1}/${y2.slice(-2)}`];
  }
  const short = String(fyLabel || '').trim().match(/^(\d{4})\/(\d{2})$/);
  if (short) {
    const y1 = parseInt(short[1], 10);
    if (Number.isFinite(y1)) {
      return [`${y1}/${y1 + 1}`, `${y1}/${short[2]}`];
    }
  }
  return [String(fyLabel || '').trim()].filter(Boolean);
}

function fyStoredVariantsSql(fyLabel: string): string {
  return fyStoredVariants(fyLabel)
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(', ');
}

const INDICATOR_MATCH_SQL = `
    (
      (
        NULLIF(TRIM(st.performance_indicator), '') IS NOT NULL
        AND LOWER(TRIM(qi.indicator_text)) = LOWER(TRIM(st.performance_indicator))
      )
      OR (
        NULLIF(TRIM(sa.target_kpi), '') IS NOT NULL
        AND LOWER(TRIM(qi.indicator_text)) = LOWER(TRIM(sa.target_kpi))
      )
      OR (
        st.performance_indicators IS NOT NULL
        AND JSON_VALID(st.performance_indicators)
        AND JSON_SEARCH(st.performance_indicators, 'one', TRIM(qi.indicator_text)) IS NOT NULL
      )
    )`;

const HOD_APPROVED_EXISTS_SQL = `
    AND (
      NOT EXISTS (
        SELECT 1 FROM q_indicator_submissions qis0
        WHERE qis0.indicator_id = r.indicator_id AND qis0.department_id = r.department_id
      )
      OR EXISTS (
        SELECT 1 FROM q_indicator_submissions qis
        WHERE qis.indicator_id = r.indicator_id
          AND qis.department_id = r.department_id
          AND qis.hod_review_status = 'approved'
      )
    )`;

/**
 * Sum numeric questionnaire responses for a strategic activity row, matched by
 * standard performance indicator (or activity target_kpi) and department.
 */
export function buildQuestionnaireActualSubquery(
  fyLabel: string,
  alias: string,
  options: QuestionnaireActualOptions = {},
): string {
  const hodApprovedOnly = options.hodApprovedOnly !== false;
  const fySql = fyStoredVariantsSql(fyLabel);

  return `(
    SELECT SUM(
      CASE
        WHEN r.value IS NOT NULL AND TRIM(r.value) <> ''
             AND TRIM(REPLACE(r.value, '%', '')) REGEXP '^-?[0-9]+(\\\\.?[0-9]*)?$'
        THEN CAST(TRIM(REPLACE(r.value, '%', '')) AS DECIMAL(20,4))
        ELSE NULL
      END
    )
    FROM q_responses r
    INNER JOIN q_indicators qi ON qi.id = r.indicator_id
    INNER JOIN q_indicator_departments qid
      ON qid.indicator_id = qi.id AND qid.department_id = sa.department_id
    WHERE r.department_id = sa.department_id
      AND sa.department_id IS NOT NULL
      AND r.financial_year IN (${fySql})
      AND ${INDICATOR_MATCH_SQL.trim()}
      ${hodApprovedOnly ? HOD_APPROVED_EXISTS_SQL : ''}
  ) AS ${alias}`;
}
