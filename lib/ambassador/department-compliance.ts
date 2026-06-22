import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';
import {
  getManagedUnitDepartmentIds,
  isDepartmentInManagedScope,
} from '@/lib/ambassador/managed-unit-departments';
import {
  computeMilestoneProgressForStrategicActivity,
  getMilestoneTasksForParentActivity,
  type MilestoneTaskStatus,
} from '@/lib/milestone-progress';

const MAIN_ACTIVITY_FILTER = `
  sa.parent_id IS NULL
  AND COALESCE(TRIM(sa.source), '') <> ''
`;

/** Latest end date HOD set on process steps for this strategic activity (parent or child tasks). */
const HOD_END_DATE_JOIN = `
  LEFT JOIN (
    SELECT
      COALESCE(act.parent_id, act.id) AS strategic_activity_id,
      MAX(spa.end_date) AS hod_end_date
    FROM staff_process_assignments spa
    INNER JOIN strategic_activities act ON spa.activity_id = act.id
    GROUP BY COALESCE(act.parent_id, act.id)
  ) hod ON hod.strategic_activity_id = sa.id
`;

/** Matches Activity Progress status labels — uses HOD due dates, not sa.end_date alone. */
const ACTIVITY_IS_DELAYED_SQL = `
  (sa.status = 'overdue'
    OR (hod.hod_end_date IS NOT NULL AND hod.hod_end_date < CURDATE() AND sa.status != 'completed'))
`;

const ACTIVITY_REQUIRES_ATTENTION_SQL = `
  (hod.hod_end_date IS NOT NULL AND (
    sa.status = 'overdue'
    OR hod.hod_end_date < CURDATE()
    OR (sa.status != 'completed' AND DATEDIFF(hod.hod_end_date, CURDATE()) <= 7)
  ))
`;

export type ManagedUnitActivityKpis = {
  totalActivities: number;
  overallProgress: number;
  onTrack: number;
  inProgress: number;
  delayed: number;
  requiresAttention: number;
};

export async function queryManagedUnitActivityKpis(
  scopedDepartmentIds: number[],
): Promise<ManagedUnitActivityKpis> {
  if (scopedDepartmentIds.length === 0) {
    return {
      totalActivities: 0,
      overallProgress: 0,
      onTrack: 0,
      inProgress: 0,
      delayed: 0,
      requiresAttention: 0,
    };
  }

  const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);
  const rows = (await query({
    query: `
      SELECT
        COUNT(sa.id) AS totalActivities,
        ROUND(IFNULL(AVG(sa.progress), 0)) AS overallProgress,
        COALESCE(SUM(CASE WHEN ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0 END), 0) AS delayed_count,
        COALESCE(SUM(CASE
          WHEN sa.status = 'completed' AND NOT ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0
        END), 0) AS on_track,
        COALESCE(SUM(CASE
          WHEN sa.status IN ('in_progress', 'pending') AND NOT ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0
        END), 0) AS in_progress,
        COALESCE(SUM(CASE WHEN ${ACTIVITY_REQUIRES_ATTENTION_SQL} THEN 1 ELSE 0 END), 0) AS requires_attention
      FROM strategic_activities sa
      ${HOD_END_DATE_JOIN}
      WHERE sa.department_id IN (${deptPlaceholders}) AND ${MAIN_ACTIVITY_FILTER}
    `,
    values: scopedDepartmentIds,
  })) as Array<{
    totalActivities: number;
    overallProgress: number;
    on_track: number;
    in_progress: number;
    delayed_count: number;
    requires_attention: number;
  }>;

  const row = rows[0] ?? {};
  return {
    totalActivities: Number(row.totalActivities ?? 0),
    overallProgress: Math.min(100, Math.max(0, Number(row.overallProgress ?? 0))),
    onTrack: Number(row.on_track ?? 0),
    inProgress: Number(row.in_progress ?? 0),
    delayed: Number(row.delayed_count ?? 0),
    requiresAttention: Number(row.requires_attention ?? 0),
  };
}

export async function queryManagedUnitMonthlyReportingRate(scopedDepartmentIds: number[]): Promise<{
  totalDepartments: number;
  departmentsReportedThisMonth: number;
  monthlyReportingRate: number;
}> {
  if (scopedDepartmentIds.length === 0) {
    return { totalDepartments: 0, departmentsReportedThisMonth: 0, monthlyReportingRate: 0 };
  }

  const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [deptCountRows, submissionRows] = await Promise.all([
    query({
      query: `
        SELECT COUNT(*) AS totalDepartments
        FROM departments d
        WHERE d.id IN (${deptPlaceholders}) AND d.is_active = 1
      `,
      values: scopedDepartmentIds,
    }) as Promise<Array<{ totalDepartments: number }>>,
    query({
      query: `
        SELECT DISTINCT u.department_id
        FROM staff_reports sr
        JOIN users u ON sr.submitted_by = u.id
        WHERE sr.status = 'submitted'
          AND u.department_id IN (${deptPlaceholders})
          AND MONTH(sr.submitted_at) = ?
          AND YEAR(sr.submitted_at) = ?
      `,
      values: [...scopedDepartmentIds, currentMonth, currentYear],
    }) as Promise<Array<{ department_id: number }>>,
  ]);

  const totalDepartments = Number(deptCountRows[0]?.totalDepartments ?? 0);
  const departmentsReportedThisMonth = submissionRows.length;
  const monthlyReportingRate = totalDepartments
    ? Math.round((departmentsReportedThisMonth / totalDepartments) * 100)
    : 0;

  return { totalDepartments, departmentsReportedThisMonth, monthlyReportingRate };
}

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
  requiresAttention: number;
  monthlyReportingRate: number;
  departmentsReportedThisMonth: number;
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

  const scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (scopedDepartmentIds.length === 0) {
    return {
      summary: {
        managedUnitName,
        totalDepartments: 0,
        totalActivities: 0,
        overallProgress: 0,
        onTrack: 0,
        inProgress: 0,
        delayed: 0,
        requiresAttention: 0,
        monthlyReportingRate: 0,
        departmentsReportedThisMonth: 0,
      },
      departments: [],
      submissionMonths: months.map((m) => m.name),
    };
  }

  const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

  const [deptRows, activityKpis, submissions, lastSubmissions] = await Promise.all([
    query({
      query: `
        SELECT
          d.id,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS name,
          COUNT(sa.id) AS activityCount,
          ROUND(IFNULL(AVG(sa.progress), 0)) AS progress,
          COALESCE(SUM(CASE
            WHEN sa.status = 'completed' AND NOT ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0
          END), 0) AS on_track,
          COALESCE(SUM(CASE
            WHEN sa.status IN ('in_progress', 'pending') AND NOT ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0
          END), 0) AS in_progress,
          COALESCE(SUM(CASE WHEN ${ACTIVITY_IS_DELAYED_SQL} THEN 1 ELSE 0 END), 0) AS delayed_count
        FROM departments d
        LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND ${MAIN_ACTIVITY_FILTER}
        ${HOD_END_DATE_JOIN}
        WHERE d.id IN (${deptPlaceholders}) AND d.is_active = 1
        GROUP BY d.id, d.name, d.external_name
        ORDER BY COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) ASC
      `,
      values: scopedDepartmentIds,
    }) as Promise<
      Array<{
        id: number;
        name: string;
        activityCount: number;
        progress: number;
        on_track: number;
        in_progress: number;
        delayed_count: number;
      }>
    >,
    queryManagedUnitActivityKpis(scopedDepartmentIds),
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
          AND u.department_id IN (${deptPlaceholders})
          AND sr.submitted_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY u.department_id, YEAR(sr.submitted_at), MONTH(sr.submitted_at)
      `,
      values: scopedDepartmentIds,
    }) as Promise<Array<{ department_id: number; month: number; year: number; count: number }>>,
    query({
      query: `
        SELECT u.department_id, MAX(sr.submitted_at) AS last_submission
        FROM staff_reports sr
        JOIN users u ON sr.submitted_by = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE sr.status = 'submitted' AND u.department_id IN (${deptPlaceholders})
        GROUP BY u.department_id
      `,
      values: scopedDepartmentIds,
    }) as Promise<Array<{ department_id: number; last_submission: string }>>,
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
      onTrack: Number(unit.on_track || 0),
      inProgress: Number(unit.in_progress || 0),
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

  const summary: FacultyComplianceSummary = {
    managedUnitName,
    totalDepartments,
    totalActivities: activityKpis.totalActivities,
    overallProgress: activityKpis.overallProgress,
    onTrack: activityKpis.onTrack,
    inProgress: activityKpis.inProgress,
    delayed: activityKpis.delayed,
    requiresAttention: activityKpis.requiresAttention,
    monthlyReportingRate,
    departmentsReportedThisMonth,
  };

  return {
    summary,
    departments,
    submissionMonths: months.map((m) => m.name),
  };
}

export async function getDepartmentActivitiesForAmbassador(
  managedUnitId: number,
  departmentId: number
) {
  const scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (!isDepartmentInManagedScope(departmentId, scopedDepartmentIds)) {
    return null;
  }

  const deptCheck = (await query({
    query: `SELECT id, COALESCE(NULLIF(TRIM(external_name), ''), name) AS name
            FROM departments WHERE id = ? AND is_active = 1`,
    values: [departmentId],
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
        hod.hod_end_date,
        sa.start_date,
        CASE
          WHEN sa.status = 'overdue'
            OR (hod.hod_end_date IS NOT NULL AND hod.hod_end_date < CURDATE() AND sa.status != 'completed')
          THEN 'Delayed'
          WHEN sa.status = 'completed' THEN 'On Track'
          WHEN sa.status IN ('in_progress', 'pending') THEN 'In Progress'
          ELSE sa.status
        END AS statusLabel
      FROM strategic_activities sa
      ${HOD_END_DATE_JOIN}
      WHERE sa.department_id = ?
        AND ${MAIN_ACTIVITY_FILTER}
      ORDER BY
        CASE
          WHEN sa.status = 'overdue'
            OR (hod.hod_end_date IS NOT NULL AND hod.hod_end_date < CURDATE() AND sa.status != 'completed')
          THEN 0
          ELSE 1
        END,
        hod.hod_end_date ASC,
        sa.title ASC
    `,
    values: [departmentId],
  })) as Array<{
    id: number;
    title: string;
    status: string;
    statusLabel: string;
    progress: number;
    hod_end_date: string | null;
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
      endDate: a.hod_end_date,
    })),
  };
}

export type ManagedUnitActivityAttention = 'Critical' | 'Warning';

/** Same rules previously used for risk alerts — applied to every activity row (not capped). */
export function resolveActivityAttentionLevel(
  statusLabel: string,
  hodEndDate: string | null,
): ManagedUnitActivityAttention | null {
  if (!hodEndDate) return null;

  const normalized = statusLabel.trim();
  if (normalized === 'Delayed') return 'Critical';

  const end = new Date(hodEndDate);
  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < today) return 'Critical';

  const daysUntil = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (normalized !== 'On Track' && daysUntil <= 7) return 'Warning';

  return null;
}

export type ManagedUnitActivityRow = {
  id: number;
  title: string;
  department: string;
  departmentId: number;
  status: string;
  progress: number;
  endDate: string | null;
  attentionLevel: ManagedUnitActivityAttention | null;
  hasMilestones: boolean;
  displayProgress: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  tasks: MilestoneTaskStatus[];
};

/** All strategic activities for the ambassador's department/unit, with milestone task breakdown when configured. */
export async function listAllManagedUnitActivities(
  managedUnitId: number
): Promise<ManagedUnitActivityRow[]> {
  const scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (scopedDepartmentIds.length === 0) return [];

  const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

  const rows = (await query({
    query: `
      SELECT
        sa.id,
        sa.title,
        sa.department_id AS departmentId,
        COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department,
        sa.progress,
        hod.hod_end_date,
        CASE
          WHEN sa.status = 'overdue'
            OR (hod.hod_end_date IS NOT NULL AND hod.hod_end_date < CURDATE() AND sa.status != 'completed')
          THEN 'Delayed'
          WHEN sa.status = 'completed' THEN 'On Track'
          WHEN sa.status IN ('in_progress', 'pending') THEN 'In Progress'
          ELSE sa.status
        END AS statusLabel
      FROM strategic_activities sa
      JOIN departments d ON sa.department_id = d.id
      ${HOD_END_DATE_JOIN}
      WHERE sa.department_id IN (${deptPlaceholders}) AND ${MAIN_ACTIVITY_FILTER}
      ORDER BY department ASC, hod.hod_end_date ASC, sa.title ASC
    `,
    values: scopedDepartmentIds,
  })) as Array<{
    id: number;
    title: string;
    departmentId: number;
    department: string;
    progress: number;
    hod_end_date: string | null;
    statusLabel: string;
  }>;

  return Promise.all(
    rows.map(async (a) => {
      const progress = Number(a.progress || 0);
      const attentionLevel = resolveActivityAttentionLevel(a.statusLabel, a.hod_end_date);
      const { tasks, parentProgress } = await getMilestoneTasksForParentActivity(a.id);

      if (tasks.length === 0) {
        return {
          id: a.id,
          title: a.title,
          departmentId: a.departmentId,
          department: a.department || '—',
          status: a.statusLabel,
          progress,
          endDate: a.hod_end_date,
          attentionLevel,
          hasMilestones: false,
          displayProgress: progress,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          tasks: [],
        };
      }

      const milestoneProgress =
        parentProgress ?? (await computeMilestoneProgressForStrategicActivity(a.id)) ?? progress;
      const completedTasks = tasks.filter((t) => t.completed).length;

      return {
        id: a.id,
        title: a.title,
        departmentId: a.departmentId,
        department: a.department || '—',
        status: a.statusLabel,
        progress,
        endDate: a.hod_end_date,
        attentionLevel,
        hasMilestones: true,
        displayProgress: milestoneProgress,
        totalTasks: tasks.length,
        completedTasks,
        pendingTasks: tasks.length - completedTasks,
        tasks,
      };
    }),
  );
}
