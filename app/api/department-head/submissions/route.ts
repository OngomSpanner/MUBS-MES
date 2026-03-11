import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({
                submissions: [],
                stats: { pending: 0, underReview: 0, reviewed: 0, returned: 0 },
                recentActivity: []
            });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        const submissionsQuery = await query({
            query: `
                SELECT 
                    sr.id,
                    sr.achievements as description,
                    sa.title as report_name,
                    p.title as activity_title,
                    u.full_name as staff_name,
                    sr.updated_at as submitted_at,
                    sr.status as db_status,
                    sr.progress_percentage as progress,
                    e.score,
                    e.qualitative_feedback as reviewer_notes,
                    e.rating
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                JOIN users u ON aa.assigned_to_user_id = u.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
                AND (sr.status IN ('submitted', 'evaluated') OR (sr.status = 'draft' AND e.id IS NOT NULL))
                ORDER BY sr.updated_at DESC
            `,
            values: [...departmentIds, ...departmentIds]
        }) as any[];

        const statusMap: Record<string, string> = {
            'draft': 'Returned',
            'submitted': 'Under Review',
            'evaluated': 'Completed'
        };

        const submissions = submissionsQuery.map((s: any) => {
            const ratingToScore: Record<string, number> = { excellent: 5, good: 4, satisfactory: 3, needs_improvement: 2, poor: 1 };
            const score1to5 = s.rating ? ratingToScore[s.rating] : (s.score != null ? Math.round(Number(s.score) / 20) : undefined);
            const { rating, ...rest } = s;
            return { ...rest, status: statusMap[s.db_status] || 'Unknown', score: score1to5 };
        });

        // Stats (Pending = awaiting review, same as Under Review for this view)
        const underReviewCount = submissions.filter((s: any) => s.status === 'Under Review').length;
        const stats = {
            pending: underReviewCount,
            underReview: underReviewCount,
            reviewed: submissions.filter((s: any) => s.status === 'Completed').length,
            returned: submissions.filter((s: any) => s.status === 'Returned').length
        };

        // Recent activity
        const recentActivity = submissions.slice(0, 5).map((s: any) => ({
            id: s.id,
            type: s.status,
            message: `${s.report_name} ${s.db_status === 'submitted' ? 'submitted' : s.db_status.toLowerCase()} by ${s.staff_name}`,
            date: s.submitted_at
        }));

        return NextResponse.json({
            submissions,
            stats,
            recentActivity
        });
    } catch (error: any) {
        console.error('Department Submissions API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department submissions', detail: error.message },
            { status: 500 }
        );
    }
}
