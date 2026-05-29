import { query } from '@/lib/db';

const MAIN_ACTIVITY_FILTER = `
  sa.parent_id IS NULL
  AND COALESCE(TRIM(sa.source), '') <> ''
`;

export type DepartmentHealth = 'Good' | 'Watch' | 'Critical';

export type DepartmentComplianceRow = {
  id: number;
  name: string;
  activityCount: number;
  progress: number;
  onTrack: number;
  inProgress: number;
  delayed: number;
  health: DepartmentHealth;
  monthlyReportStatus: 'submitted' | 'pending';
  lastSubmission: string | null;
  submissionHistory: Array<{ month: string; year: number; status: 'submitted' | 'missing' }>;
};

export type FacultyComplianceSummary = {
  managedUnitName: string;
  totalDepartments: number;
  totalActivities: number;
  overallProgress: number;
  onTrack: number;
  inProgress: number;
  delayed: number;
  monthlyReportingRate: number;
  departmentsReportedThisMonth: number;
};

export type RiskAlertRow = {
  id: number;
  title: string;
  department: string;
  departmentId: number;
  status: 'Critical' | 'Warning';
  progress: number;
  dueDate: string | null;
};

export async function getDepartmentComplianceBundle(managedUnitId: number, managedUnitName: string) {
  const months: Array<{ name: string; year: number; month: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      name: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [deptRows, kpiRow, submissions, lastSubmissions, riskRows] = await Promise.all([
    query({
      query: `
        SELECT
          d.id,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS name,
          COUNT(sa.id) AS activityCount,
          ROUND(IFNULL(AVG(sa.progress), 0)) AS progress,
          COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) AS onTrack,
          COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) AS inProgress,
          COALESCE(SUM(CASE
            WHEN sa.status = 'overdue'
              OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed')
            THEN 1 ELSE 0
          END), 0) AS delayed_count
        FROM departments d
        LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND ${MAIN_ACTIVITY_FILTER}
        WHERE d.parent_id = ? AND d.is_active = 1
        GROUP BY d.id, d.name, d.external_name
        ORDER BY COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) ASC
      `,
      values: [managedUnitId],
    }) as Promise<
      Array<{
        id: number;
        name: string;
        activityCount: number;
        progress: number;
        onTrack: number;
        inProgress: number;
        delayed_count: number;
      }>
    >,
    query({
      query: `
        SELECT
          COUNT(sa.id) AS totalActivities,
          ROUND(IFNULL(AVG(sa.progress), 0)) AS overallProgress,
          COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) AS onTrack,
          COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) AS inProgress,
          COALESCE(SUM(CASE
            WHEN sa.status = 'overdue'
              OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed')
            THEN 1 ELSE 0
          END), 0) AS delayed_count
        FROM strategic_activities sa
        JOIN departments d ON sa.department_id = d.id
        WHERE d.parent_id = ? AND ${MAIN_ACTIVITY_FILTER}
      `,
      values: [managedUnitId],
    }) as Promise<
      Array<{
        totalActivities: number;
        overallProgress: number;
        onTrack: number;
        inProgress: number;
        delayed_count: number;
      }>
    >,
    query({
      query: `
        SELECT
          u.department_id,
          MONTH(sr.submitted_at) AS month,
          YEAR(sr.submitted_at) AS year,
          COUNT(sr.id) AS count
        FROM staff_reports sr
        JOIN users u ON sr.submitted_by = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE sr.status = 'submitted'
          AND d.parent_id = ?
          AND sr.submitted_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY u.department_id, YEAR(sr.submitted_at), MONTH(sr.submitted_at)
      `,
      values: [managedUnitId],
    }) as Promise<Array<{ department_id: number; month: number; year: number; count: number }>>,
    query({
      query: `
        SELECT u.department_id, MAX(sr.submitted_at) AS last_submission
        FROM staff_reports sr
        JOIN users u ON sr.submitted_by = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE sr.status = 'submitted' AND d.parent_id = ?
        GROUP BY u.department_id
      `,
      values: [managedUnitId],
    }) as Promise<Array<{ department_id: number; last_submission: string }>>,
    query({
      query: `
        SELECT
          sa.id,
          sa.title,
          d.id AS departmentId,
          d.name AS department,
          sa.status,
          sa.progress,
          sa.end_date,
          CASE
            WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE())
            THEN 'Critical'
            ELSE 'Warning'
          END AS statusLabel
        FROM strategic_activities sa
        JOIN departments d ON sa.department_id = d.id
        WHERE d.parent_id = ? AND ${MAIN_ACTIVITY_FILTER}
          AND (
            sa.status = 'overdue'
            OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE())
            OR (sa.status != 'completed' AND sa.end_date IS NOT NULL AND DATEDIFF(sa.end_date, CURDATE()) <= 7)
          )
        ORDER BY sa.end_date ASC
        LIMIT 8
      `,
      values: [managedUnitId],
    }) as Promise<
      Array<{
        id: number;
        title: string;
        departmentId: number;
        department: string;
        statusLabel: 'Critical' | 'Warning';
        progress: number;
        end_date: string | null;
      }>
    >,
  ]);

  const lastSubmissionMap = new Map(
    lastSubmissions.map((r) => [r.department_id, r.last_submission])
  );

  const departments: DepartmentComplianceRow[] = deptRows.map((unit) => {
    const activityCount = Number(unit.activityCount || 0);
    const progress = Math.min(100, Math.max(0, Number(unit.progress || 0)));
    const delayed = Number(unit.delayed_count || 0);

    let health: DepartmentHealth = 'Good';
    if (delayed > 0 || (activityCount > 0 && progress < 50)) health = 'Critical';
    else if (activityCount > 0 && progress < 70) health = 'Watch';

    const submissionHistory = months.map((m) => {
      const found = submissions.find(
        (s) =>
          s.department_id === unit.id && s.month === m.month && s.year === m.year
      );
      return {
        month: m.name,
        year: m.year,
        status: found ? ('submitted' as const) : ('missing' as const),
      };
    });

    const currentMonthSubmitted = submissions.some(
      (s) =>
        s.department_id === unit.id &&
        s.month === currentMonth &&
        s.year === currentYear
    );

    return {
      id: unit.id,
      name: unit.name,
      activityCount,
      progress,
      onTrack: Number(unit.onTrack || 0),
      inProgress: Number(unit.inProgress || 0),
      delayed,
      health,
      monthlyReportStatus: currentMonthSubmitted ? 'submitted' : 'pending',
      lastSubmission: lastSubmissionMap.get(unit.id) ?? null,
      submissionHistory,
    };
  });

  const totalDepartments = departments.length;
  const departmentsReportedThisMonth = departments.filter(
    (d) => d.monthlyReportStatus === 'submitted'
  ).length;
  const monthlyReportingRate = totalDepartments
    ? Math.round((departmentsReportedThisMonth / totalDepartments) * 100)
    : 0;

  const kpi = kpiRow[0] ?? {};
  const summary: FacultyComplianceSummary = {
    managedUnitName,
    totalDepartments,
    totalActivities: Number(kpi.totalActivities ?? 0),
    overallProgress: Math.min(100, Math.max(0, Number(kpi.overallProgress ?? 0))),
    onTrack: Number(kpi.onTrack ?? 0),
    inProgress: Number(kpi.inProgress ?? 0),
    delayed: Number(kpi.delayed_count ?? 0),
    monthlyReportingRate,
    departmentsReportedThisMonth,
  };

  const riskAlerts: RiskAlertRow[] = riskRows.map((r) => ({
    id: r.id,
    title: r.title,
    department: r.department,
    departmentId: r.departmentId,
    status: r.statusLabel,
    progress: Number(r.progress || 0),
    dueDate: r.end_date,
  }));

  return {
    summary,
    departments,
    riskAlerts,
    submissionMonths: months.map((m) => m.name),
  };
}

export async function getDepartmentActivitiesForAmbassador(
  managedUnitId: number,
  departmentId: number
) {
  const deptCheck = (await query({
    query: 'SELECT id, name FROM departments WHERE id = ? AND parent_id = ? AND is_active = 1',
    values: [departmentId, managedUnitId],
  })) as Array<{ id: number; name: string }>;

  if (!deptCheck.length) {
    return null;
  }

  const activities = (await query({
    query: `
      SELECT
        sa.id,
        sa.title,
        sa.status,
        sa.progress,
        sa.end_date,
        sa.start_date,
        CASE
          WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE())
          THEN 'Delayed'
          WHEN sa.status = 'completed' THEN 'On Track'
          WHEN sa.status IN ('in_progress', 'pending') THEN 'In Progress'
          ELSE sa.status
        END AS statusLabel
      FROM strategic_activities sa
      WHERE sa.department_id = ?
        AND ${MAIN_ACTIVITY_FILTER}
      ORDER BY
        CASE
          WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) THEN 0
          ELSE 1
        END,
        sa.end_date ASC,
        sa.title ASC
    `,
    values: [departmentId],
  })) as Array<{
    id: number;
    title: string;
    status: string;
    statusLabel: string;
    progress: number;
    end_date: string | null;
    start_date: string | null;
  }>;

  return {
    department: deptCheck[0],
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.statusLabel,
      progress: Number(a.progress || 0),
      startDate: a.start_date,
      endDate: a.end_date,
    })),
  };
}

export type ManagedUnitActivityRow = {
  id: number;
  title: string;
  department: string;
  departmentId: number;
  status: string;
  progress: number;
  endDate: string | null;
};

/** All strategic activities under departments in the managed faculty/office. */
export async function listAllManagedUnitActivities(
  managedUnitId: number
): Promise<ManagedUnitActivityRow[]> {
  const rows = (await query({
    query: `
      SELECT
        sa.id,
        sa.title,
        sa.department_id AS departmentId,
        COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department,
        sa.progress,
        sa.end_date,
        CASE
          WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE())
          THEN 'Delayed'
          WHEN sa.status = 'completed' THEN 'On Track'
          WHEN sa.status IN ('in_progress', 'pending') THEN 'In Progress'
          ELSE sa.status
        END AS statusLabel
      FROM strategic_activities sa
      JOIN departments d ON sa.department_id = d.id
      WHERE d.parent_id = ? AND ${MAIN_ACTIVITY_FILTER}
      ORDER BY department ASC, sa.end_date ASC, sa.title ASC
    `,
    values: [managedUnitId],
  })) as Array<{
    id: number;
    title: string;
    departmentId: number;
    department: string;
    progress: number;
    end_date: string | null;
    statusLabel: string;
  }>;

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    departmentId: a.departmentId,
    department: a.department || '—',
    status: a.statusLabel,
    progress: Number(a.progress || 0),
    endDate: a.end_date,
  }));
}
