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

        // strategic_activities: status enum('pending','in_progress','completed','overdue'), progress int. Only top-level (parent_id IS NULL).
        const summaryStats = await query({
            query: `
                SELECT 
                    COUNT(*) as \`totalActivities\`,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as \`onTrack\`,
                    COALESCE(SUM(CASE WHEN status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as \`inProgress\`,
                    COALESCE(SUM(CASE WHEN status = 'overdue' OR (end_date IS NOT NULL AND end_date < CURDATE() AND status != 'completed') THEN 1 ELSE 0 END), 0) as \`delayed\`
                FROM strategic_activities
                WHERE parent_id IS NULL
            `
        }) as any[];

        const departments = await query({
            query: `
                SELECT 
                    d.id,
                    d.parent_id,
                    d.unit_type,
                    d.name,
                    (SELECT full_name FROM users WHERE id = d.hod_id LIMIT 1) as head,
                    COUNT(sa.id) as activitiesCount,
                    ROUND(IFNULL(AVG(sa.progress), 0)) as overallProgress,
                    COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) as completedCount,
                    COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as inProgressCount,
                    COALESCE(SUM(CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed') THEN 1 ELSE 0 END), 0) as delayedCount
                FROM departments d
                LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL
                WHERE d.is_active = 1
                GROUP BY d.id, d.parent_id, d.unit_type, d.name, d.hod_id
                ORDER BY (d.parent_id IS NULL) DESC, d.name ASC
            `
        }) as any[];

        const recentActivities = await query({
            query: `
                SELECT sa.id, sa.title, sa.department_id, sa.progress, sa.pillar,
                    CASE sa.status WHEN 'completed' THEN 'On Track' WHEN 'in_progress' THEN 'In Progress' WHEN 'overdue' THEN 'Delayed' ELSE 'Pending' END as status
                FROM strategic_activities sa
                WHERE sa.parent_id IS NULL
                ORDER BY sa.department_id, sa.updated_at DESC
            `
        }) as any[];

        const risks = await query({
            query: `
                SELECT sa.id, sa.title, sa.department_id, sa.description, sa.end_date,
                    DATEDIFF(sa.end_date, CURDATE()) as daysLeft
                FROM strategic_activities sa
                WHERE sa.parent_id IS NULL
                AND sa.status != 'completed'
                AND (sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()))
            `
        }) as any[];

        const deptIds = (departments as any[]).map((d: any) => d.id);
        const byDept: Record<number, { activities: any[]; risks: any[] }> = {};
        deptIds.forEach((id: number) => { byDept[id] = { activities: [], risks: [] }; });
        (recentActivities as any[]).forEach((a: any) => {
            if (a.department_id && byDept[a.department_id]) {
                if (byDept[a.department_id].activities.length < 3) byDept[a.department_id].activities.push(a);
            }
        });
        (risks as any[]).forEach((r: any) => {
            if (r.department_id && byDept[r.department_id]) byDept[r.department_id].risks.push(r);
        });

        // Pillars per department (for filtering)
        const pillarsByDept = await query({
            query: `
                SELECT department_id, pillar
                FROM strategic_activities
                WHERE parent_id IS NULL AND pillar IS NOT NULL AND department_id IS NOT NULL
                GROUP BY department_id, pillar
            `
        }) as any[];
        const pillarsMap: Record<number, string[]> = {};
        deptIds.forEach((id: number) => { pillarsMap[id] = []; });
        (pillarsByDept as any[]).forEach((p: any) => {
            if (pillarsMap[p.department_id] && !pillarsMap[p.department_id].includes(p.pillar)) {
                pillarsMap[p.department_id].push(p.pillar);
            }
        });

        const row0 = summaryStats[0];
        const stats = {
            totalActivities: Number(row0?.totalActivities ?? 0),
            onTrack: Number(row0?.onTrack ?? 0),
            inProgress: Number(row0?.inProgress ?? 0),
            delayed: Number(row0?.delayed ?? 0),
        };

        return NextResponse.json({
            stats,
            departments: (departments as any[]).map((u: any) => ({
                id: Number(u.id),
                parent_id: u.parent_id != null ? Number(u.parent_id) : null,
                unit_type: u.unit_type ?? null,
                name: u.name,
                head: u.head ?? null,
                activitiesCount: Number(u.activitiesCount ?? 0),
                overallProgress: Number(u.overallProgress ?? 0),
                completedCount: Number(u.completedCount ?? 0),
                inProgressCount: Number(u.inProgressCount ?? 0),
                delayedCount: Number(u.delayedCount ?? 0),
                pillars: pillarsMap[u.id] ?? [],
                recentActivities: (byDept[u.id]?.activities ?? []).map((a: any) => ({
                    id: a.id,
                    title: a.title,
                    progress: Number(a.progress ?? 0),
                    status: a.status,
                    pillar: a.pillar ?? '',
                })),
                risks: (byDept[u.id]?.risks ?? []).map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description ?? '',
                    end_date: r.end_date,
                    daysLeft: Number(r.daysLeft ?? 0),
                })),
            }))
        });
    } catch (error: any) {
        console.error('Strategic Summary API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching strategic summary data', detail: error.message },
            { status: 500 }
        );
    }
}
