/** Latest due date HOD set on process steps for this activity (parent or child task tree). */
export const HOD_DUE_DATE_SUBQUERY = `
  (
    SELECT MAX(spa.end_date)
    FROM staff_process_assignments spa
    INNER JOIN strategic_activities act ON spa.activity_id = act.id
    WHERE COALESCE(act.parent_id, act.id) = COALESCE(sa.parent_id, sa.id)
  ) AS due_date
`;
