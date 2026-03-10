import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Department progress
    const departmentRows = await query({
      query: `
        SELECT
          u.name,
          COUNT(sa.id) AS activities,
          ROUND(IFNULL(AVG(sa.progress), 0)) AS progress,
          SUM(CASE WHEN sa.status = 'Delayed' THEN 1 ELSE 0 END) AS delayed_count
        FROM departments u
        LEFT JOIN strategic_activities sa ON u.id = sa.department_id
        GROUP BY u.id, u.name
        ORDER BY u.name
      `
    }) as any[];

    const departmentProgress = departmentRows.map(r => {
      const prog = Number(r.progress);
      const health = prog >= 70 ? 'Good' : prog >= 50 ? 'Watch' : 'Critical';
      return {
        name: r.name,
        activities: Number(r.activities),
        progress: prog,
        delayed: Number(r.delayed_count),
        health
      };
    });

    // 2. Delayed activities
    const delayedRows = await query({
      query: `
        SELECT
          sa.id,
          sa.title,
          u.name AS department,
          DATE_FORMAT(sa.end_date, '%d %b %Y') AS deadline,
          DATEDIFF(CURDATE(), sa.end_date) AS daysOverdue,
          sa.progress
        FROM strategic_activities sa
        LEFT JOIN departments u ON sa.department_id = u.id
        WHERE sa.status = 'Delayed'
        ORDER BY sa.end_date ASC
      `
    }) as any[];

    const delayedActivities = delayedRows.map(r => ({
      id: r.id,
      title: r.title,
      department: r.department ?? 'Unknown',
      deadline: r.deadline ?? '—',
      daysOverdue: Math.max(0, Number(r.daysOverdue ?? 0)),
      progress: Number(r.progress ?? 0)
    }));

    // 3. Upcoming deadline alerts (due within 7 days)
    const upcomingRows = await query({
      query: `
        SELECT
          sa.title,
          u.name AS department,
          DATEDIFF(sa.end_date, CURDATE()) AS daysUntilDue
        FROM strategic_activities sa
        LEFT JOIN departments u ON sa.department_id = u.id
        WHERE sa.status NOT IN ('Completed', 'Delayed')
          AND sa.end_date >= CURDATE()
          AND sa.end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY sa.end_date ASC
        LIMIT 6
      `
    }) as any[];

    const upcomingAlerts = upcomingRows.map((r: any) => ({
      title: r.title,
      department: r.department ?? 'Unknown',
      description: `Due in ${r.daysUntilDue} day${Number(r.daysUntilDue) === 1 ? '' : 's'}`,
      days: Number(r.daysUntilDue),
      type: 'due' as const
    }));

    const overdueAlerts = delayedActivities.slice(0, 4).map(r => ({
      title: r.title,
      department: r.department,
      description: r.daysOverdue === 0 ? 'Due today' : `Overdue by ${r.daysOverdue} day${r.daysOverdue === 1 ? '' : 's'}`,
      days: r.daysOverdue,
      type: 'overdue' as const
    }));

    const alerts = [...overdueAlerts, ...upcomingAlerts].slice(0, 6);

    // 4. Summary stats
    const statsRows = await query({
      query: `
        SELECT
          SUM(CASE WHEN status = 'On Track'    THEN 1 ELSE 0 END) AS onTrack,
          SUM(CASE WHEN status = 'Delayed'     THEN 1 ELSE 0 END) AS delayed_total,
          SUM(CASE WHEN status = 'In Progress' AND end_date < CURDATE() THEN 1 ELSE 0 END) AS atRisk
        FROM strategic_activities
      `
    }) as any[];

    const summary = {
      onTrack: Number(statsRows[0]?.onTrack ?? 0),
      delayed: Number(statsRows[0]?.delayed_total ?? 0),
      atRisk: Number(statsRows[0]?.atRisk ?? 0),
      alerts: overdueAlerts.length + upcomingAlerts.length
    };

    return NextResponse.json({ departmentProgress, delayedActivities, alerts, summary });
  } catch (error: any) {
    console.error('Tracking API error:', error);
    return NextResponse.json(
      { message: 'Error fetching tracking data', detail: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
