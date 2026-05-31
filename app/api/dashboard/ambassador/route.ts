import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const MAIN_ACTIVITY_FILTER = `
  sa.parent_id IS NULL
  AND COALESCE(TRIM(sa.source), '') <> ''
`;

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as { userId?: number } | null;
        if (!decoded?.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const userResult = await query({
            query: 'SELECT managed_unit_id, role FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as { managed_unit_id: number | null; role: string }[];

        if (userResult.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const managedUnitId = userResult[0].managed_unit_id;

        if (!managedUnitId) {
            return NextResponse.json({ message: 'Ambassador is not assigned to any department or unit' }, { status: 403 });
        }

        const unitResult = await query({
            query: `SELECT COALESCE(NULLIF(TRIM(external_name), ''), name) AS name FROM departments WHERE id = ?`,
            values: [managedUnitId]
        }) as { name: string }[];
        const managedUnitName = unitResult[0]?.name || 'Unknown Department/Unit';

        const kpiStats = await query({
            query: `
                SELECT 
                    COUNT(sa.id) as \`totalActivities\`,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as \`overallProgress\`,
                    COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) as \`onTrack\`,
                    COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as \`inProgress\`,
                    COALESCE(SUM(CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed') THEN 1 ELSE 0 END), 0) as \`delayed\`
                FROM strategic_activities sa
                WHERE sa.department_id = ? AND ${MAIN_ACTIVITY_FILTER}
            `,
            values: [managedUnitId]
        }) as {
            totalActivities: number;
            overallProgress: number;
            onTrack: number;
            inProgress: number;
            delayed: number;
        }[];

        const statsRow = kpiStats[0];

        const subUnits = await query({
            query: `
                SELECT 
                    d.id,
                    COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) as department,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as progress,
                    COUNT(sa.id) as activityCount
                FROM departments d
                LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                WHERE d.id = ? AND d.is_active = 1
                GROUP BY d.id, d.name, d.external_name
            `,
            values: [managedUnitId]
        }) as { id: number; department: string; progress: number; activityCount: number }[];

        const totalUnits = subUnits.length;
        const compliantUnits = await query({
            query: `
                SELECT COUNT(DISTINCT u.department_id) as compliant_count
                FROM users u 
                JOIN staff_reports sr ON u.id = sr.submitted_by 
                WHERE u.department_id = ?
                  AND sr.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            `,
            values: [managedUnitId]
        }) as { compliant_count: number }[];

        const compliantCount = Number(compliantUnits[0]?.compliant_count || 0);
        const complianceRate = totalUnits ? Math.round((compliantCount / totalUnits) * 100) : 0;

        const riskAlerts = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) as department,
                    sa.status,
                    sa.progress,
                    sa.end_date,
                    CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) THEN 'Critical' ELSE 'Warning' END as statusLabel
                FROM strategic_activities sa
                JOIN departments d ON sa.department_id = d.id
                WHERE sa.department_id = ? AND ${MAIN_ACTIVITY_FILTER}
                AND (sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) OR (sa.status != 'completed' AND sa.end_date IS NOT NULL AND DATEDIFF(sa.end_date, CURDATE()) <= 7))
                ORDER BY sa.end_date ASC
                LIMIT 5
            `,
            values: [managedUnitId]
        }) as {
            id: number;
            title: string;
            department: string;
            statusLabel: string;
            progress: number;
            end_date: string | null;
        }[];

        return NextResponse.json({
            managedUnitName,
            stats: {
                totalActivities: Number(statsRow?.totalActivities ?? 0),
                overallProgress: Number(statsRow?.overallProgress ?? 0),
                complianceRate,
                onTrack: Number(statsRow?.onTrack ?? 0),
                inProgress: Number(statsRow?.inProgress ?? 0),
                delayed: Number(statsRow?.delayed ?? 0),
                totalUnits
            },
            subUnits: subUnits.map((u) => ({
                id: u.id,
                name: u.department,
                progress: Math.min(100, Math.max(0, Number(u.progress || 0))),
                activityCount: Number(u.activityCount || 0)
            })),
            riskAlerts: riskAlerts.map((r) => ({
                id: r.id,
                title: r.title,
                department: r.department,
                status: r.statusLabel,
                progress: Number(r.progress || 0),
                dueDate: r.end_date
            }))
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Ambassador Dashboard API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching ambassador dashboard data', detail: message },
            { status: 500 }
        );
    }
}
