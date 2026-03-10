import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        // Fetch evaluated tasks for this user
        const feedbackRecords = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title as report_name,
                    p.title as activity_title,
                    u.full_name as evaluator_name,
                    sa.updated_at as evaluated_at,
                    sa.status,
                    sa.score,
                    sa.reviewer_notes
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN users u ON p.department_id = (SELECT id FROM departments WHERE name = u.department LIMIT 1) AND u.role = 'Department Head'
                WHERE sa.assigned_to = ?
                AND sa.status IN ('Completed', 'Returned')
                ORDER BY sa.updated_at DESC
            `,
            values: [decoded.userId]
        }) as any[];

        // Calculate stats correctly handling null scores
        let totalScore = 0;
        let evaluatedCount = 0;

        feedbackRecords.forEach(record => {
            if (record.score !== null && record.score !== undefined) {
                totalScore += record.score;
                evaluatedCount++;
            }
        });

        const overallAverage = evaluatedCount > 0 ? (totalScore / evaluatedCount).toFixed(1) : '0.0';

        const stats = {
            totalEvaluations: feedbackRecords.length,
            averageScore: overallAverage,
            completionRate: feedbackRecords.length > 0
                ? Math.round((feedbackRecords.filter(r => r.status === 'Completed').length / feedbackRecords.length) * 100)
                : 0,
            returnedCount: feedbackRecords.filter(r => r.status === 'Returned').length
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
