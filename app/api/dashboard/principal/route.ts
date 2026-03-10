import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Institutional KPIs
    const kpiStats = await query({
      query: `
                SELECT 
                    COUNT(*) as \`totalActivities\`,
                    ROUND(IFNULL(AVG(progress), 0)) as \`overallProgress\`,
                    SUM(CASE WHEN status IN ('On Track', 'Completed') THEN 1 ELSE 0 END) as \`onTrack\`,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as \`inProgress\`,
                    SUM(CASE WHEN status = 'Delayed' THEN 1 ELSE 0 END) as \`delayed\`,
                    (SELECT COUNT(*) FROM departments) as \`totalUnits\`,
                    (SELECT COUNT(*) FROM users WHERE status = 'Active' OR status = 'active') as \`activeStaff\`
                FROM strategic_activities
                WHERE parent_id IS NULL
            `
    }) as any[];

    const stats = kpiStats[0];

    // 2. Compliance by Department (Top 5)
    const complianceByUnit = await query({
      query: `
                SELECT 
                    u.name as department, 
                    ROUND(IFNULL(AVG(sa.progress), 0)) as progress
                FROM departments u
                LEFT JOIN strategic_activities sa ON u.id = sa.department_id AND sa.parent_id IS NULL
                GROUP BY u.id, u.name
                ORDER BY progress DESC
                LIMIT 5
            `
    }) as any[];

    // 3. Active Risk Alerts (Delayed or near-deadline)
    const riskAlerts = await query({
      query: `
                SELECT 
                    sa.id,
                    sa.title,
                    u.name as department,
                    sa.status,
                    sa.progress,
                    sa.end_date,
                    CASE 
                        WHEN sa.status = 'Delayed' THEN 'Critical'
                        ELSE 'Warning'
                    END as statusLabel,
                    DATEDIFF(sa.end_date, CURDATE()) as daysLeft,
                    DATEDIFF(CURDATE(), sa.end_date) as daysPast
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                WHERE (sa.status = 'Delayed' OR (sa.status != 'Completed' AND DATEDIFF(sa.end_date, CURDATE()) <= 7))
                AND sa.parent_id IS NULL
                ORDER BY sa.end_date ASC
                LIMIT 4
            `
    }) as any[];

    // 4. Overdue Activities for the table
    const overdueActivities = await query({
      query: `
                SELECT 
                    sa.id,
                    sa.title,
                    u.name as department,
                    DATEDIFF(CURDATE(), sa.end_date) as daysOverdue,
                    sa.progress
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                WHERE sa.status = 'Delayed' AND sa.parent_id IS NULL
                ORDER BY daysOverdue DESC
                LIMIT 4
            `
    }) as any[];

    // Compliance rate (departments with progress >= 75%)
    const complianceRate = Math.round((complianceByUnit.filter(u => u.progress >= 75).length / (stats.totalUnits || 1)) * 100);

    return NextResponse.json({
      stats: {
        ...stats,
        complianceRate,
        riskAlerts: riskAlerts.length
      },
      complianceByUnit,
      riskAlerts: riskAlerts.map(r => ({
        ...r,
        status: r.statusLabel
      })),
      overdueActivities
    });
  } catch (error: any) {
    console.error('Principal Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching principal dashboard data', detail: error.message },
      { status: 500 }
    );
  }
}
