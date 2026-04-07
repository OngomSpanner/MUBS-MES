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
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // strategic_activities: status enum('pending','in_progress','completed','overdue'). Only top-level (parent_id IS NULL).
    // departments.is_active = 1. users.status = 'Active'.
    const kpiStats = await query({
      query: `
                SELECT 
                    COUNT(*) as \`totalActivities\`,
                    ROUND(IFNULL(AVG(progress), 0)) as \`overallProgress\`,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as \`onTrack\`,
                    COALESCE(SUM(CASE WHEN status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as \`inProgress\`,
                    COALESCE(SUM(CASE WHEN status = 'overdue' OR (end_date IS NOT NULL AND end_date < CURDATE() AND status != 'completed') THEN 1 ELSE 0 END), 0) as \`delayed\`,
                    (SELECT COUNT(*) FROM departments WHERE is_active = 1) as \`totalUnits\`,
                    (SELECT COUNT(*) FROM users WHERE status = 'Active') as \`activeStaff\`
                FROM strategic_activities
                WHERE parent_id IS NULL AND COALESCE(TRIM(source), '') <> ''
            `
    }) as any[];

    const row0 = kpiStats[0];

    // 2. Compliance by Department — all departments with parent_id for hierarchy (faculty/office → departments/units)
    const complianceByUnit = await query({
      query: `
                SELECT 
                    d.id,
                    d.parent_id,
                    d.unit_type,
                    d.name as department, 
                    ROUND(IFNULL(AVG(sa.progress), 0)) as progress
                FROM departments d
                LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                WHERE d.is_active = 1
                GROUP BY d.id, d.parent_id, d.unit_type, d.name
                ORDER BY (d.parent_id IS NULL) DESC, d.name ASC
            `
    }) as any[];

    const compliantResult = await query({
      query: `
                SELECT COUNT(*) as compliant FROM (
                    SELECT d.id, ROUND(IFNULL(AVG(sa.progress), 0)) as p
                    FROM departments d
                    LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                    WHERE d.is_active = 1
                    GROUP BY d.id
                    HAVING p >= 75
                ) t
            `
    }) as any[];
    const totalUnitsResult = await query({ query: 'SELECT COUNT(*) as c FROM departments WHERE is_active = 1', values: [] }) as any[];
    const compliantCount = Number(compliantResult[0]?.compliant ?? 0);
    const totalUnitsDept = Number(totalUnitsResult[0]?.c ?? 0);
    const complianceRate = totalUnitsDept ? Math.round((compliantCount / totalUnitsDept) * 100) : 0;

    // Faculties & offices (root units only)
    const facultiesResult = await query({
      query: 'SELECT COUNT(*) as c FROM departments WHERE is_active = 1 AND parent_id IS NULL',
      values: []
    }) as any[];
    const facultiesCount = Number(facultiesResult[0]?.c ?? 0);

    // Activities due in the next 7 days (not completed, not yet overdue)
    const dueThisWeekResult = await query({
      query: `
        SELECT COUNT(*) as c FROM strategic_activities
        WHERE parent_id IS NULL AND COALESCE(TRIM(source), '') <> '' AND status != 'completed'
        AND end_date IS NOT NULL AND end_date >= CURDATE() AND end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      `,
      values: []
    }) as any[];
    const dueThisWeek = Number(dueThisWeekResult[0]?.c ?? 0);

    // 3. Active Risk Alerts — strategic activities only (parent_id IS NULL), not department-level child tasks
    const riskAlerts = await query({
      query: `
                SELECT 
                    sa.id,
                    sa.title,
                    sa.pillar,
                    d.name as department,
                    sa.status,
                    sa.progress,
                    sa.end_date,
                    CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) THEN 'Critical' ELSE 'Warning' END as statusLabel,
                    DATEDIFF(sa.end_date, CURDATE()) as daysLeft,
                    DATEDIFF(CURDATE(), sa.end_date) as daysPast
                FROM strategic_activities sa
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                AND (sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) OR (sa.status != 'completed' AND sa.end_date IS NOT NULL AND DATEDIFF(sa.end_date, CURDATE()) <= 7))
                ORDER BY sa.end_date ASC
                LIMIT 10
            `
    }) as any[];

    // 4. Overdue Activities
    const overdueActivities = await query({
      query: `
                SELECT 
                    sa.id,
                    sa.title,
                    d.name as department,
                    DATEDIFF(CURDATE(), sa.end_date) as daysOverdue,
                    sa.progress
                FROM strategic_activities sa
                LEFT JOIN departments d ON sa.department_id = d.id
                WHERE sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> '' AND sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed'
                ORDER BY sa.end_date ASC
                LIMIT 10
            `
    }) as any[];

    const stats = {
      totalActivities: Number(row0?.totalActivities ?? 0),
      overallProgress: Number(row0?.overallProgress ?? 0),
      complianceRate,
      onTrack: Number(row0?.onTrack ?? 0),
      inProgress: Number(row0?.inProgress ?? 0),
      delayed: Number(row0?.delayed ?? 0),
      totalUnits: Number(row0?.totalUnits ?? 0),
      riskAlerts: riskAlerts.length,
      activeStaff: Number(row0?.activeStaff ?? 0),
      facultiesCount,
      dueThisWeek,
    };

    return NextResponse.json({
      stats,
      complianceByUnit: (complianceByUnit as any[]).map((r: any) => ({
        id: Number(r.id),
        parent_id: r.parent_id != null ? Number(r.parent_id) : null,
        unit_type: r.unit_type ?? null,
        department: r.department ?? '',
        progress: Math.max(0, Math.min(100, Number(r.progress ?? 0))),
      })),
      riskAlerts: riskAlerts.map((r: any) => ({
        id: r.id,
        title: r.title,
        pillar: r.pillar != null ? String(r.pillar) : null,
        department: r.department ?? null,
        daysPast: r.daysPast != null ? Number(r.daysPast) : undefined,
        daysLeft: r.daysLeft != null ? Number(r.daysLeft) : undefined,
        progress: Number(r.progress ?? 0),
        status: r.statusLabel,
      })),
      overdueActivities: (overdueActivities as any[]).map((r: any) => ({
        id: r.id,
        title: r.title,
        department: r.department ?? '—',
        daysOverdue: Number(r.daysOverdue ?? 0),
        progress: Number(r.progress ?? 0),
      })),
    });
  } catch (error: any) {
    console.error('Principal Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching principal dashboard data', detail: error.message },
      { status: 500 }
    );
  }
}
