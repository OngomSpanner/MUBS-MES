import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // 1. Department progress: all active departments + strategic_activities
    // DB status enum: pending, in_progress, completed, overdue
    const departmentRows = (await query({
      query: `
        SELECT
          d.id,
          d.name,
          COUNT(sa.id) AS activities,
          ROUND(IFNULL(AVG(sa.progress), 0)) AS progress,
          SUM(CASE
            WHEN sa.status = 'overdue' THEN 1
            WHEN sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status NOT IN ('completed') THEN 1
            ELSE 0
          END) AS delayed_count
        FROM departments d
        LEFT JOIN strategic_activities sa ON d.id = sa.department_id
        WHERE d.is_active = 1
        GROUP BY d.id, d.name
        ORDER BY d.name
      `
    })) as any[];

    const departmentProgress = departmentRows.map((r: any) => {
      const prog = Number(r.progress ?? 0);
      const delayed = Number(r.delayed_count ?? 0);
      let health: 'Good' | 'Watch' | 'Critical' = 'Good';
      if (delayed > 0 || (r.activities > 0 && prog < 50)) health = 'Critical';
      else if (r.activities > 0 && prog < 70) health = 'Watch';
      return {
        name: r.name,
        activities: Number(r.activities ?? 0),
        progress: prog,
        delayed,
        health
      };
    });

    // 2. Delayed activities: status = 'overdue' OR (end_date < today AND not completed)
    const delayedRows = (await query({
      query: `
        SELECT
          sa.id,
          sa.title,
          d.name AS department,
          sa.end_date,
          DATE_FORMAT(sa.end_date, '%d %b %Y') AS deadline_fmt,
          DATEDIFF(CURDATE(), sa.end_date) AS daysOverdue,
          sa.progress
        FROM strategic_activities sa
        LEFT JOIN departments d ON sa.department_id = d.id
        WHERE sa.status = 'overdue'
           OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status NOT IN ('completed'))
        ORDER BY sa.end_date ASC
      `
    })) as any[];

    const delayedActivities = delayedRows.map((r: any) => ({
      id: r.id,
      title: r.title,
      department: r.department ?? 'Not assigned',
      deadline: r.deadline_fmt ?? (r.end_date ? new Date(r.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
      daysOverdue: Math.max(0, Number(r.daysOverdue ?? 0)),
      progress: Number(r.progress ?? 0)
    }));

    // 3. Alerts: overdue + due within 7 days (include activity_id for reminder actions)
    const overdueAlerts = delayedActivities.slice(0, 6).map((r) => ({
      activity_id: r.id,
      title: r.title,
      department: r.department,
      description: r.daysOverdue === 0 ? 'Due today' : `Overdue by ${r.daysOverdue} day${r.daysOverdue === 1 ? '' : 's'}`,
      days: r.daysOverdue,
      type: 'overdue' as const
    }));

    const upcomingRows = (await query({
      query: `
        SELECT
          sa.id,
          sa.title,
          d.name AS department,
          DATEDIFF(sa.end_date, CURDATE()) AS daysUntilDue
        FROM strategic_activities sa
        LEFT JOIN departments d ON sa.department_id = d.id
        WHERE sa.status NOT IN ('completed', 'overdue')
          AND sa.end_date IS NOT NULL
          AND sa.end_date >= CURDATE()
          AND sa.end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY sa.end_date ASC
        LIMIT 6
      `
    })) as any[];

    const upcomingAlerts = upcomingRows.map((r: any) => ({
      activity_id: r.id,
      title: r.title,
      department: r.department ?? 'Not assigned',
      description: `Due in ${r.daysUntilDue} day${Number(r.daysUntilDue) === 1 ? '' : 's'}`,
      days: Number(r.daysUntilDue),
      type: 'due' as const
    }));

    const alerts = [...overdueAlerts, ...upcomingAlerts].slice(0, 10);

    // 4. Summary: onTrack, delayed, atRisk, alerts
    const summaryRows = (await query({
      query: `
        SELECT
          SUM(CASE
            WHEN status IN ('pending','in_progress') AND (end_date IS NULL OR end_date >= CURDATE()) THEN 1
            ELSE 0
          END) AS onTrack,
          SUM(CASE
            WHEN status = 'overdue' OR (end_date IS NOT NULL AND end_date < CURDATE() AND status != 'completed') THEN 1
            ELSE 0
          END) AS delayed_total,
          SUM(CASE
            WHEN status IN ('pending','in_progress')
              AND end_date IS NOT NULL AND end_date >= CURDATE() AND end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            THEN 1 ELSE 0
          END) AS atRisk
        FROM strategic_activities
      `
    })) as any[];

    const summary = {
      onTrack: Number(summaryRows[0]?.onTrack ?? 0),
      delayed: Number(summaryRows[0]?.delayed_total ?? 0),
      atRisk: Number(summaryRows[0]?.atRisk ?? 0),
      alerts: alerts.length
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
