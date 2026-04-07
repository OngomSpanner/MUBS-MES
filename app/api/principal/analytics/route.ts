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

        const departmentPerformance = await query({
            query: `
                SELECT d.name as \`label\`, ROUND(IFNULL(AVG(sa.progress), 0)) as \`value\`
                FROM departments d
                LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                WHERE d.is_active = 1
                GROUP BY d.id, d.name
                ORDER BY \`value\` DESC
            `
        }) as any[];

        const validUnits = departmentPerformance.filter((u: any) => u.value != null && !isNaN(u.value));
        const institutionAverage = validUnits.length > 0
            ? Math.round(validUnits.reduce((acc: number, curr: any) => acc + Number(curr.value), 0) / validUnits.length)
            : 0;

        const statusRows = await query({
            query: `
                SELECT status, COUNT(*) as count
                FROM strategic_activities
                WHERE parent_id IS NULL AND COALESCE(TRIM(source), '') <> ''
                GROUP BY status
            `
        }) as any[];

        const statusMap: Record<string, string> = { completed: 'Completed', in_progress: 'In Progress', overdue: 'Delayed', pending: 'On Track' };
        const statusSplit = statusRows.map((r: any) => ({ status: statusMap[r.status] || r.status, count: Number(r.count) }));

        const compliantCount = departmentPerformance.filter((u: any) => Number(u.value) >= 75).length;
        const watchCount = departmentPerformance.filter((u: any) => Number(u.value) >= 50 && Number(u.value) < 75).length;
        const criticalCount = departmentPerformance.filter((u: any) => Number(u.value) < 50).length;

        const staffPerformance = await query({
            query: `
                SELECT 
                    u.full_name as name,
                    d.name as department,
                    COUNT(aa.id) as totalActivities,
                    SUM(CASE WHEN aa.status IN ('completed') THEN 1 ELSE 0 END) as completed,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as rate
                FROM users u
                LEFT JOIN activity_assignments aa ON aa.assigned_to_user_id = u.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE u.role NOT IN ('principal', 'system_admin') AND u.department_id IS NOT NULL
                GROUP BY u.id, u.full_name, d.name
                HAVING totalActivities > 0
                ORDER BY rate DESC
                LIMIT 15
            `
        }) as any[];

        return NextResponse.json({
            departmentPerformance,
            institutionAverage,
            statusSplit,
            complianceDistribution: {
                compliant: compliantCount,
                watch: watchCount,
                critical: criticalCount
            },
            staffPerformance: (staffPerformance as any[]).map((s: any) => ({
                ...s,
                totalActivities: Number(s.totalActivities),
                completed: Number(s.completed),
                rate: Number(s.rate)
            }))
        });
    } catch (error: any) {
        console.error('Performance Analytics API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching performance analytics data', detail: error.message },
            { status: 500 }
        );
    }
}
