import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { sqlTopStrategicMain } from '@/lib/strategic-activity-sql';

export const dynamic = 'force-dynamic';

/** Same visibility as `/api/department-head/activities` (parent goals + strategic_plan unit copies). Excludes departmental-only (empty source) rows. */
function activityVisibilitySql(): string {
  return `(
                  (${sqlTopStrategicMain('sa')})
                  OR (sa.parent_id IS NOT NULL AND COALESCE(sa.source, '') = 'strategic_plan')
                )`;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as any;
    if (!decoded?.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    let departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json({
        stats: {
          totalActivities: 0,
          onTrack: 0,
          delayed: 0,
          totalTasks: 0,
          pendingSubmissions: 0,
          hrAlerts: 0,
        },
        departmentalStats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 },
        hrWarnings: [],
        activityProgress: [],
        departmentalProgress: [],
        recentSubmissions: [],
        noDepartment: true,
      });
    }
    departmentIds = departmentIds.map((id: number) => Number(id));

    const deptRows = await query({
      query: `SELECT id, name FROM departments WHERE id IN (${inPlaceholders(departmentIds.length)})`,
      values: [...departmentIds],
    }) as any[];
    const departmentNames = (deptRows || []).map((r: any) => r.name).filter(Boolean);
    const primaryId = departmentIds[0];
    const departmentName =
      primaryId != null
        ? (deptRows || []).find((r: any) => Number(r.id) === Number(primaryId))?.name ||
          departmentNames[0] ||
          null
        : departmentNames[0] || null;

    const placeholders = inPlaceholders(departmentIds.length);
    const vis = activityVisibilitySql();

    // --- Activities: same queries + mapping as `/api/department-head/activities` ---
    const mainQuery = await query({
      query: `
                SELECT 
                    sa.*,
                    u.name as unit_name,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id AND c.department_id IN (${placeholders})) as total_tasks,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id AND c.department_id IN (${placeholders}) AND c.status = 'completed') as completed_tasks,
                    COALESCE((
                        SELECT COUNT(*) FROM standard_processes sp
                        WHERE sp.standard_id = sa.standard_id
                    ), 0) AS process_tasks_total,
                    COALESCE((
                        SELECT COUNT(DISTINCT spa.standard_process_id)
                        FROM staff_process_assignments spa
                        WHERE spa.activity_id = sa.id
                          AND LOWER(TRIM(spa.status)) IN ('evaluated', 'completed')
                    ), 0) AS process_tasks_done,
                    NULL as parent_title
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                WHERE ${sqlTopStrategicMain('sa')} AND sa.department_id IN (${placeholders})
                ORDER BY sa.end_date ASC
            `,
      values: [...departmentIds, ...departmentIds, ...departmentIds],
    }) as any[];

    let childQuery: any[];
    try {
      childQuery = await query({
        query: `
                    SELECT 
                        sa.*,
                        u.name as unit_name,
                        (SELECT COUNT(*) FROM strategic_activities c WHERE c.department_id = sa.department_id AND (c.parent_id = sa.id OR c.parent_id = sa.parent_id)) as total_tasks,
                        (SELECT COUNT(*) FROM strategic_activities c WHERE c.department_id = sa.department_id AND (c.parent_id = sa.id OR c.parent_id = sa.parent_id) AND c.status = 'completed') as completed_tasks,
                        COALESCE((
                            SELECT COUNT(*) FROM standard_processes sp
                            WHERE sp.standard_id = sa.standard_id
                        ), 0) AS process_tasks_total,
                        COALESCE((
                            SELECT COUNT(DISTINCT spa.standard_process_id)
                            FROM staff_process_assignments spa
                            WHERE spa.activity_id = sa.id
                              AND LOWER(TRIM(spa.status)) IN ('evaluated', 'completed')
                        ), 0) AS process_tasks_done,
                        p.title as parent_title
                    FROM strategic_activities sa
                    LEFT JOIN departments u ON sa.department_id = u.id
                    LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                    WHERE sa.department_id IN (${placeholders}) AND sa.parent_id IS NOT NULL
                    AND COALESCE(sa.source, '') = 'strategic_plan'
                    ORDER BY sa.end_date ASC
                `,
        values: [...departmentIds],
      }) as any[];
    } catch (e: any) {
      if (e?.message?.includes('source') || e?.code === 'ER_BAD_FIELD_ERROR') {
        childQuery = [];
      } else {
        throw e;
      }
    }

    const activitiesQuery = [...mainQuery, ...childQuery];

    const dbStatusMap: Record<string, string> = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'On Track',
      overdue: 'Delayed',
    };

    const activities = activitiesQuery.map((a: any) => {
      const totalTasks = Number(a.total_tasks) || 0;
      const completedTasks = Number(a.completed_tasks) || 0;
      const storedProgress = a.progress != null ? Number(a.progress) : 0;

      const progress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : storedProgress;

      const status =
        totalTasks > 0
          ? progress >= 100
            ? 'On Track'
            : progress > 0
              ? 'In Progress'
              : dbStatusMap[a.status] || a.status
          : dbStatusMap[a.status] || a.status;

      return { ...a, progress, status };
    });

    const activityStats = {
      totalActivities: activities.length,
      onTrack: activities.filter((a) => a.status === 'On Track').length,
      delayed: activities.filter((a) => a.status === 'Delayed').length,
    };

    // Process assignment rows (standard-process work) tied to visible strategic activities
    const processTaskCount = await query({
      query: `
                SELECT COUNT(spa.id) as cnt
                FROM staff_process_assignments spa
                INNER JOIN strategic_activities sa ON spa.activity_id = sa.id
                WHERE sa.department_id IN (${placeholders})
                  AND ${vis}
            `,
      values: [...departmentIds],
    }) as any[];

    const totalTasks = Number(processTaskCount[0]?.cnt || 0);

    // Pending review: submitted reports (legacy assignments + process assignments)
    const pendingLegacy = await query({
      query: `
                SELECT COUNT(sr.id) as cnt
                FROM staff_reports sr
                INNER JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                INNER JOIN strategic_activities sa ON aa.activity_id = sa.id
                WHERE sr.status = 'submitted'
                  AND sa.department_id IN (${placeholders})
                  AND ${vis}
            `,
      values: [...departmentIds],
    }) as any[];

    const pendingProcess = await query({
      query: `
                SELECT COUNT(sr.id) as cnt
                FROM staff_reports sr
                INNER JOIN staff_process_assignments spa ON sr.process_assignment_id = spa.id
                INNER JOIN strategic_activities sa ON spa.activity_id = sa.id
                WHERE sr.status = 'submitted'
                  AND sa.department_id IN (${placeholders})
                  AND ${vis}
            `,
      values: [...departmentIds],
    }) as any[];

    const pendingSubmissions =
      Number(pendingLegacy[0]?.cnt || 0) + Number(pendingProcess[0]?.cnt || 0);

    const hrWarnings = await query({
      query: `
                SELECT 
                    full_name,
                    role,
                    leave_status,
                    contract_end_date,
                    DATEDIFF(contract_end_date, CURDATE()) as \`daysRemaining\`
                FROM users 
                WHERE department_id IN (${placeholders})
                AND (leave_status != 'On Duty' 
                  OR (contract_end_date IS NOT NULL AND DATEDIFF(contract_end_date, CURDATE()) <= 30))
                LIMIT 4
            `,
      values: [...departmentIds],
    }) as any[];

    // Next 4 activities by due date (aligned with activities list ordering)
    const activityProgress = [...activities]
      .sort((a, b) => {
        const da = new Date(a.end_date || '9999-12-31').getTime();
        const db = new Date(b.end_date || '9999-12-31').getTime();
        return da - db;
      })
      .slice(0, 4)
      .map((row: any) => ({
        title: row.title,
        status: row.status,
        progress: row.progress != null ? Number(row.progress) : 0,
        end_date: row.end_date,
      }));

    const departmentalRows = (await query({
      query: `
        SELECT sa.*, d.name as unit_name
        FROM strategic_activities sa
        LEFT JOIN departments d ON d.id = sa.department_id
        WHERE sa.department_id IN (${placeholders})
          AND sa.parent_id IS NULL
          AND COALESCE(sa.source, '') = ''
          AND sa.activity_type = 'detailed'
        ORDER BY sa.end_date ASC
      `,
      values: [...departmentIds],
    })) as any[];

    const dbStatusMapDept: Record<string, string> = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'On Track',
      overdue: 'Delayed',
    };

    const departmentalActivities = (departmentalRows || []).map((a: any) => {
      const progress = a.progress != null ? Number(a.progress) : 0;
      const status = progress >= 100 ? 'On Track' : dbStatusMapDept[a.status] || a.status;
      return { ...a, progress, status };
    });

    const departmentalStats = {
      total: departmentalActivities.length,
      onTrack: departmentalActivities.filter((a: any) => a.status === 'On Track').length,
      inProgress: departmentalActivities.filter((a: any) => a.status === 'In Progress').length,
      delayed: departmentalActivities.filter((a: any) => a.status === 'Delayed').length,
    };

    const departmentalProgress = [...departmentalActivities]
      .sort((a, b) => {
        const da = new Date(a.end_date || '9999-12-31').getTime();
        const db = new Date(b.end_date || '9999-12-31').getTime();
        return da - db;
      })
      .slice(0, 4)
      .map((row: any) => ({
        title: row.title,
        status: row.status,
        progress: row.progress != null ? Number(row.progress) : 0,
        end_date: row.end_date,
      }));

    const recentUnion = await query({
      query: `
                SELECT staff, task, date, status, sort_ts FROM (
                    SELECT 
                        u.full_name as staff,
                        sa.title as task,
                        DATE_FORMAT(sr.updated_at, '%d %b, %H:%i') as date,
                        sr.status as status,
                        sr.updated_at as sort_ts
                    FROM staff_reports sr
                    INNER JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                    INNER JOIN strategic_activities sa ON aa.activity_id = sa.id
                    INNER JOIN users u ON sr.submitted_by = u.id
                    WHERE sa.department_id IN (${placeholders})
                      AND ${vis}
                      AND sr.status IN ('submitted', 'evaluated')
                    UNION ALL
                    SELECT 
                        u.full_name as staff,
                        CONCAT(sa.title, ' — ', sp.step_name) as task,
                        DATE_FORMAT(sr.updated_at, '%d %b, %H:%i') as date,
                        sr.status as status,
                        sr.updated_at as sort_ts
                    FROM staff_reports sr
                    INNER JOIN staff_process_assignments spa ON sr.process_assignment_id = spa.id
                    INNER JOIN strategic_activities sa ON spa.activity_id = sa.id
                    INNER JOIN standard_processes sp ON spa.standard_process_id = sp.id
                    INNER JOIN users u ON sr.submitted_by = u.id
                    WHERE sa.department_id IN (${placeholders})
                      AND ${vis}
                      AND sr.status IN ('submitted', 'evaluated')
                ) sub
                ORDER BY sort_ts DESC
                LIMIT 4
            `,
      values: [...departmentIds, ...departmentIds],
    }) as any[];

    const submissionStatusMap: Record<string, string> = {
      submitted: 'Pending Review',
      evaluated: 'Reviewed',
    };
    const formattedSubmissions = recentUnion.map((row: any) => ({
      staff: row.staff,
      task: row.task,
      date: row.date,
      status: submissionStatusMap[row.status] || row.status,
    }));

    return NextResponse.json({
      departmentName: departmentName || 'Department',
      stats: {
        totalActivities: activityStats.totalActivities,
        onTrack: activityStats.onTrack,
        delayed: activityStats.delayed,
        totalTasks,
        pendingSubmissions,
        hrAlerts: hrWarnings.length,
      },
      departmentalStats,
      hrWarnings,
      activityProgress,
      departmentalProgress,
      recentSubmissions: formattedSubmissions,
    });
  } catch (error: any) {
    console.error('Department Head Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching department head dashboard data', detail: error.message },
      { status: 500 }
    );
  }
}
