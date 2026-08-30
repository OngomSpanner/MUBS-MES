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
                    COALESCE(
                        sa.title,
                        CASE
                          WHEN sps.id IS NOT NULL THEN CONCAT_WS(' — ', NULLIF(sp.step_name, ''), NULLIF(sps.title, ''))
                          ELSE sp.step_name
                        END
                    ) as report_name,
                    COALESCE(p.title, psa_sa.title) as activity_title,
                    u.full_name as staff_name,
                    sr.updated_at as submitted_at,
                    sr.status as db_status,
                    sr.progress_percentage as progress,
                    e.score,
                    e.qualitative_feedback as reviewer_notes,
                    e.rating
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
                LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
                LEFT JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                JOIN users u ON COALESCE(aa.assigned_to_user_id, spa.staff_id, sps.assigned_to) = u.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}) OR psa_sa.department_id IN (${placeholders}))
                AND (sr.status IN ('submitted', 'evaluated', 'incomplete', 'not_done') OR (sr.status = 'draft' AND e.id IS NOT NULL))
                ORDER BY sr.updated_at DESC
            `,
            values: [...departmentIds, ...departmentIds, ...departmentIds]
        }) as any[];

        const statusMap: Record<string, string> = {
            'draft': 'Returned',
            'submitted': 'Under Review',
            'evaluated': 'Completed',
            'incomplete': 'Incomplete',
            'not_done': 'Not Done'
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
