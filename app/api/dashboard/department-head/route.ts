import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

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

    const departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json({
        stats: { totalActivities: 0, onTrack: 0, inProgress: 0, delayed: 0, totalTasks: 0, pendingSubmissions: 0, hrAlerts: 0 },
        hrWarnings: [],
        activityProgress: [],
        recentSubmissions: [],
        noDepartment: true
      });
    }

    const placeholders = inPlaceholders(departmentIds.length);

    // 1. Department Stats (Activities) - main activities in visible departments
    const activityStats = await query({
      query: `
                SELECT 
                    COUNT(*) as \`totalActivities\`,
                    SUM(CASE WHEN status IN ('completed', 'in_progress') THEN 1 ELSE 0 END) as \`onTrack\`,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as \`inProgress\`,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as \`delayed\`
                FROM strategic_activities
                WHERE department_id IN (${placeholders}) AND parent_id IS NULL
            `,
      values: [...departmentIds]
    }) as any[];

    // 2. Task Stats (from activity_assignments linked to department's activities)
    const taskStats = await query({
      query: `
                SELECT 
                    COUNT(aa.id) as \`totalTasks\`,
                    SUM(CASE WHEN aa.status = 'submitted' THEN 1 ELSE 0 END) as \`pendingSubmissions\`
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                WHERE sa.department_id IN (${placeholders}) OR sa.parent_id IN (SELECT id FROM strategic_activities WHERE department_id IN (${placeholders}))
            `,
      values: [...departmentIds, ...departmentIds]
    }) as any[];

    // 3. HR Warnings - users in any visible department
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
      values: [...departmentIds]
    }) as any[];

    // 4. Activity Progress Table - main activities with progress computed from child tasks
    const activityProgressQuery = await query({
      query: `
                SELECT 
                    sa.id,
                    sa.title,
                    sa.status,
                    sa.progress as stored_progress,
                    sa.end_date,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id) as child_count,
                    (SELECT COUNT(*) FROM strategic_activities c WHERE c.parent_id = sa.id AND c.status = 'completed') as child_completed
                FROM strategic_activities sa
                WHERE sa.department_id IN (${placeholders}) AND sa.parent_id IS NULL
                ORDER BY sa.created_at DESC
                LIMIT 4
            `,
      values: [...departmentIds]
    }) as any[];
    
    // Map db status to UI status; use computed progress from child tasks when available
    const dbStatusMap: Record<string, string> = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'On Track',
      'overdue': 'Delayed'
    };
    const activityProgress = activityProgressQuery.map((row: any) => {
      const childCount = Number(row.child_count) || 0;
      const childCompleted = Number(row.child_completed) || 0;
      const computedProgress = childCount > 0
        ? Math.round((childCompleted / childCount) * 100)
        : (row.stored_progress != null ? Number(row.stored_progress) : 0);
      return {
        title: row.title,
        status: dbStatusMap[row.status] || row.status,
        progress: computedProgress,
        end_date: row.end_date
      };
    });

    // 5. Recent Submissions (from staff_reports)
    const recentSubmissions = await query({
      query: `
                SELECT 
                    u.full_name as \`staff\`,
                    sa.title as \`task\`,
                    DATE_FORMAT(sr.updated_at, '%d %b, %H:%i') as \`date\`,
                    sr.status as \`status\`
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                JOIN users u ON sr.submitted_by = u.id
                WHERE (sa.department_id IN (${placeholders}) OR sa.parent_id IN (SELECT id FROM strategic_activities WHERE department_id IN (${placeholders})))
                AND sr.status IN ('submitted', 'evaluated')
                ORDER BY sr.updated_at DESC
                LIMIT 4
            `,
      values: [...departmentIds, ...departmentIds]
    }) as any[];

    const submissionStatusMap: Record<string, string> = {
      'submitted': 'Pending Review',
      'evaluated': 'Reviewed'
    };
    const formattedSubmissions = recentSubmissions.map((row: any) => ({
      ...row,
      status: submissionStatusMap[row.status] || row.status
    }));

    return NextResponse.json({
      stats: {
        totalActivities: activityStats[0]?.totalActivities || 0,
        onTrack: activityStats[0]?.onTrack || 0,
        inProgress: activityStats[0]?.inProgress || 0,
        delayed: activityStats[0]?.delayed || 0,
        totalTasks: taskStats[0]?.totalTasks || 0,
        pendingSubmissions: taskStats[0]?.pendingSubmissions || 0,
        hrAlerts: hrWarnings.length
      },
      hrWarnings,
      activityProgress,
      recentSubmissions: formattedSubmissions
    });
  } catch (error: any) {
    console.error('Department Head Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching department head dashboard data', detail: error.message },
      { status: 500 }
    );
  }
}
