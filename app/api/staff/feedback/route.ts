import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ratingToScore: Record<string, number> = { excellent: 5, good: 4, satisfactory: 3, needs_improvement: 2, poor: 1 };

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        // Fetch evaluated reports: evaluated/acknowledged, or draft with evaluation (returned for revision)
        const feedbackRecordsRaw = await query({
            query: `
                SELECT 
                    sr.id,
                    sa.title as report_name,
                    p.title as activity_title,
                    u.full_name as evaluator_name,
                    COALESCE(e.evaluation_date, sr.updated_at) as evaluated_at,
                    sr.status as db_status,
                    e.rating,
                    e.qualitative_feedback as reviewer_notes
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                LEFT JOIN users u ON e.evaluated_by = u.id
                WHERE aa.assigned_to_user_id = ?
                AND (sr.status IN ('evaluated', 'acknowledged') OR (sr.status = 'draft' AND e.id IS NOT NULL))
                ORDER BY evaluated_at DESC
            `,
            values: [decoded.userId]
        }) as any[];

        const feedbackRecords = feedbackRecordsRaw.map(r => {
            const status = (r.db_status === 'evaluated' || r.db_status === 'acknowledged') ? 'Completed' : 'Returned';
            const score = r.rating ? ratingToScore[r.rating] : null;
            return {
                ...r,
                status,
                score: score ?? 0,
                evaluator_name: r.evaluator_name || 'Department Head'
            };
        }).map(({ rating, ...rest }) => rest);

        let totalScore = 0;
        let evaluatedCount = 0;
        feedbackRecords.forEach((record: any) => {
            if (record.score != null && record.score > 0) {
                totalScore += record.score;
                evaluatedCount++;
            }
        });
        const overallAverage = evaluatedCount > 0 ? (totalScore / evaluatedCount).toFixed(1) : '0.0';

        const stats = {
            totalEvaluations: feedbackRecords.length,
            averageScore: overallAverage,
            completionRate: feedbackRecords.length > 0
                ? Math.round((feedbackRecords.filter((r: any) => r.status === 'Completed').length / feedbackRecords.length) * 100)
                : 0,
            returnedCount: feedbackRecords.filter((r: any) => r.status === 'Returned').length
        };

        return NextResponse.json({
            feedback: feedbackRecords,
            stats
        });

    } catch (error: any) {
        console.error('Staff Feedback API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff feedback', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
