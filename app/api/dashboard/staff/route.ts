import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ratingToScore: Record<string, number> = { excellent: 5, good: 4, satisfactory: 3, needs_improvement: 2, poor: 1 };

function formatRelative(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString();
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');
        const userId = decoded.userId;

        // 1. Task stats from assigned activities only
        const taskStats = await query({
            query: `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN aa.status IN ('completed','evaluated') OR (aa.status = 'submitted' AND sa.progress >= 100) THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN aa.status IN ('in_progress','accepted','pending') AND (aa.end_date >= CURDATE()) THEN 1 ELSE 0 END) as inProgress,
                    SUM(CASE WHEN aa.end_date < CURDATE() AND aa.status NOT IN ('completed') THEN 1 ELSE 0 END) as overdue
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                WHERE aa.assigned_to_user_id = ?
            `,
            values: [userId]
        }) as any[];

        const stats = {
            assigned: Number(taskStats[0]?.total || 0),
            overdue: Number(taskStats[0]?.overdue || 0),
            inProgress: Number(taskStats[0]?.inProgress || 0),
            completed: Number(taskStats[0]?.completed || 0)
        };

        // 2. Upcoming deadlines (assigned tasks not completed)
        const deadlinesRaw = await query({
            query: `
                SELECT 
                    sa.title,
                    sa.description,
                    aa.end_date as dueDate,
                    aa.status as db_status,
                    sa.progress,
                    DATEDIFF(aa.end_date, CURDATE()) as daysLeft
                FROM activity_assignments aa
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                WHERE aa.assigned_to_user_id = ?
                AND aa.status NOT IN ('completed')
                ORDER BY aa.end_date ASC
                LIMIT 10
            `,
            values: [userId]
        }) as any[];

        const deadlines = deadlinesRaw.map((d: any) => ({
            title: d.title,
            description: d.description || '',
            dueDate: d.dueDate,
            status: d.daysLeft < 0 ? 'Delayed' : (d.db_status === 'submitted' ? 'Under Review' : 'In Progress'),
            progress: Number(d.progress || 0),
            daysLeft: Number(d.daysLeft)
        }));

        // 3. Recent feedback (evaluated reports for this user)
        const feedbackRaw = await query({
            query: `
                SELECT 
                    sr.id,
                    sa.title as report_name,
                    COALESCE(e.evaluation_date, sr.updated_at) as evaluated_at,
                    sr.status as db_status,
                    e.rating,
                    e.qualitative_feedback
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE aa.assigned_to_user_id = ?
                AND (sr.status IN ('evaluated', 'acknowledged') OR (sr.status = 'draft' AND e.id IS NOT NULL))
                ORDER BY evaluated_at DESC
                LIMIT 5
            `,
            values: [userId]
        }) as any[];

        const feedback = feedbackRaw.map((f: any) => {
            const score = f.rating ? ratingToScore[f.rating] : null;
            const status = f.db_status === 'evaluated' || f.db_status === 'acknowledged' ? 'Completed' : 'Returned';
            return {
                id: f.id,
                task: f.report_name,
                score: score ?? 0,
                status,
                date: formatRelative(f.evaluated_at)
            };
        });

        // Average score for dashboard stat
        const avgResult = await query({
            query: `
                SELECT AVG(CASE e.rating
                    WHEN 'excellent' THEN 5 WHEN 'good' THEN 4 WHEN 'satisfactory' THEN 3
                    WHEN 'needs_improvement' THEN 2 WHEN 'poor' THEN 1 ELSE NULL END) as avg_score
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE aa.assigned_to_user_id = ? AND e.rating IS NOT NULL
            `,
            values: [userId]
        }) as any[];
        const averageScore = avgResult[0]?.avg_score != null ? Number(Number(avgResult[0].avg_score).toFixed(1)) : null;

        return NextResponse.json({ stats, deadlines, feedback, averageScore });
    } catch (error: any) {
        console.error('Staff Dashboard API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff dashboard data', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
