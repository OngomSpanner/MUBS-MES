import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const departmentId = 1; // Faculty of Computing and Informatics
    const departmentName = 'Faculty of Computing and Informatics';

    // 1. Department Stats (Activities)
    const activityStats = await query({
      query: `
                SELECT 
                    COUNT(*) as \`totalActivities\`,
                    SUM(CASE WHEN status IN ('On Track', 'Completed') THEN 1 ELSE 0 END) as \`onTrack\`,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as \`inProgress\`,
                    SUM(CASE WHEN status = 'Delayed' THEN 1 ELSE 0 END) as \`delayed\`
                FROM strategic_activities
                WHERE department_id = ? AND parent_id IS NULL
            `,
      values: [departmentId]
    }) as any[];

    // 2. Task Stats
    const taskStats = await query({
      query: `
                SELECT 
                    COUNT(*) as \`totalTasks\`,
                    SUM(CASE WHEN status = 'Pending' OR status = 'Under Review' THEN 1 ELSE 0 END) as \`pendingSubmissions\`
                FROM strategic_activities
                WHERE (department_id = ? OR parent_id IN (SELECT id FROM strategic_activities WHERE department_id = ?))
                AND parent_id IS NOT NULL
            `,
      values: [departmentId, departmentId]
    }) as any[];

    // 3. HR Warnings
    const hrWarnings = await query({
      query: `
                SELECT 
                    full_name,
                    role,
                    leave_status,
                    contract_end_date,
                    DATEDIFF(contract_end_date, CURDATE()) as \`daysRemaining\`
                FROM users 
                WHERE department = ?
                AND (leave_status != 'On Duty' 
                  OR (contract_end_date IS NOT NULL AND DATEDIFF(contract_end_date, CURDATE()) <= 30))
                LIMIT 4
            `,
      values: [departmentName]
    }) as any[];

    // 4. Activity Progress Table
    const activityProgress = await query({
      query: `
                SELECT 
                    title,
                    status,
                    progress,
                    end_date
                FROM strategic_activities
                WHERE department_id = ? AND parent_id IS NULL
                ORDER BY created_at DESC
                LIMIT 4
            `,
      values: [departmentId]
    }) as any[];

    // 5. Recent Submissions
    const recentSubmissions = await query({
      query: `
                SELECT 
                    u.full_name as \`staff\`,
                    sa.title as \`task\`,
                    DATE_FORMAT(sa.updated_at, '%d %b, %H:%i') as \`date\`,
                    sa.status as \`status\`
                FROM strategic_activities sa
                LEFT JOIN users u ON sa.assigned_to = u.id
                WHERE (sa.department_id = ? OR sa.parent_id IN (SELECT id FROM strategic_activities WHERE department_id = ?))
                AND sa.parent_id IS NOT NULL
                AND sa.status IN ('Pending', 'Under Review', 'Completed', 'Returned')
                ORDER BY sa.updated_at DESC
                LIMIT 4
            `,
      values: [departmentId, departmentId]
    }) as any[];

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
      recentSubmissions
    });
  } catch (error: any) {
    console.error('Department Head Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching department head dashboard data', detail: error.message },
      { status: 500 }
    );
  }
}
