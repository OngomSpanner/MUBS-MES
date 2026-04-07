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

        // 1. Get Ambassador's Managed Unit
        const userResult = await query({
            query: 'SELECT managed_unit_id, role FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as any[];

        if (userResult.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const user = userResult[0];
        const managedUnitId = user.managed_unit_id;

        if (!managedUnitId) {
            return NextResponse.json({ message: 'Ambassador is not assigned to any Faculty/Office' }, { status: 403 });
        }

        // 2. Get Unit Name (Faculty/Office)
        const unitResult = await query({
            query: 'SELECT name FROM departments WHERE id = ?',
            values: [managedUnitId]
        }) as any[];
        const managedUnitName = unitResult[0]?.name || 'Unknown Faculty/Office';

        // 3. Get Aggregated Stats for all Departments under this Faculty/Office
        // Filter: strategic_activities linked to departments whose parent_id is managedUnitId
        const kpiStats = await query({
            query: `
                SELECT 
                    COUNT(sa.id) as \`totalActivities\`,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as \`overallProgress\`,
                    COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) as \`onTrack\`,
                    COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as \`inProgress\`,
                    COALESCE(SUM(CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed') THEN 1 ELSE 0 END), 0) as \`delayed\`
                FROM strategic_activities sa
                JOIN departments d ON sa.department_id = d.id
                WHERE d.parent_id = ? AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
            `,
            values: [managedUnitId]
        }) as any[];

        const statsRow = kpiStats[0];

        // 4. Get List of Sub-Units (Departments) and their Progress
        const subUnits = await query({
            query: `
                SELECT 
                    d.id,
                    d.name as department,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as progress,
                    COUNT(sa.id) as activityCount
                FROM departments d
                LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                WHERE d.parent_id = ? AND d.is_active = 1
                GROUP BY d.id, d.name
                ORDER BY d.name ASC
            `,
            values: [managedUnitId]
        }) as any[];

        // 5. Compliance Calculation (Actual report submissions in the last 30 days)
        const totalUnits = subUnits.length;
        const compliantUnits = await query({
            query: `
                SELECT COUNT(DISTINCT d.id) as compliant_count
                FROM departments d
                WHERE d.parent_id = ? AND d.id IN (
                    SELECT DISTINCT u.department_id 
                    FROM users u 
                    JOIN staff_reports sr ON u.id = sr.submitted_by 
                    WHERE sr.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                )
            `,
            values: [managedUnitId]
        }) as any[];

        const compliantCount = Number(compliantUnits[0]?.compliant_count || 0);
        const complianceRate = totalUnits ? Math.round((compliantCount / totalUnits) * 100) : 0;

        // 6. Risk Alerts (Top 5 overdue/warning activities in the faculty)
        const riskAlerts = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    d.name as department,
                    sa.status,
                    sa.progress,
                    sa.end_date,
                    CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) THEN 'Critical' ELSE 'Warning' END as statusLabel
                FROM strategic_activities sa
                JOIN departments d ON sa.department_id = d.id
                WHERE d.parent_id = ? AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                AND (sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) OR (sa.status != 'completed' AND sa.end_date IS NOT NULL AND DATEDIFF(sa.end_date, CURDATE()) <= 7))
                ORDER BY sa.end_date ASC
                LIMIT 5
            `,
            values: [managedUnitId]
        }) as any[];

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
            subUnits: subUnits.map((u: any) => ({
                id: u.id,
                name: u.department,
                progress: Math.min(100, Math.max(0, Number(u.progress || 0))),
                activityCount: Number(u.activityCount || 0)
            })),
            riskAlerts: riskAlerts.map((r: any) => ({
                id: r.id,
                title: r.title,
                department: r.department,
                status: r.statusLabel,
                progress: Number(r.progress || 0),
                dueDate: r.end_date
            }))
        });

    } catch (error: any) {
        console.error('Ambassador Dashboard API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching ambassador dashboard data', detail: error.message },
            { status: 500 }
        );
    }
}
