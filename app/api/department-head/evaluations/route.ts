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
            return NextResponse.json({ pending: [], completed: [] });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        const evaluationsQuery = await query({
            query: `
                SELECT 
                    sr.id,
                    sa.title as report_name,
                    p.title as activity_title,
                    u.full_name as staff_name,
                    sr.updated_at as submitted_at,
                    sr.status as db_status,
                    sr.progress_percentage as progress,
                    sr.achievements as report_summary,
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

        const evaluations = evaluationsQuery.map((e: any) => {
            const ratingToScore: Record<string, number> = { excellent: 5, good: 4, satisfactory: 3, needs_improvement: 2, poor: 1 };
            const score1to5 = e.rating ? ratingToScore[e.rating] : (e.score != null ? Math.round(Number(e.score) / 20) : undefined);
            const displayStatus = e.db_status === 'submitted' ? 'Pending' : (e.db_status === 'draft' ? 'Returned' : 'Completed');
            return {
                ...e,
                status: displayStatus,
                score: score1to5
            };
        });
        evaluations.forEach((e: any) => { delete e.rating; });

        const pending = evaluations.filter((e: any) => e.status === 'Pending');
        const completed = evaluations.filter((e: any) => e.status === 'Completed' || e.status === 'Returned');

        return NextResponse.json({
            pending,
            completed
        });
    } catch (error: any) {
        console.error('Department Evaluations API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department evaluations', detail: error.message },
            { status: 500 }
        );
    }
}

const ratingFromScore = (score: number): 'poor' | 'needs_improvement' | 'satisfactory' | 'good' | 'excellent' => {
    if (score <= 1) return 'poor';
    if (score <= 2) return 'needs_improvement';
    if (score <= 3) return 'satisfactory';
    if (score <= 4) return 'good';
    return 'excellent';
};

export async function PUT(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');
        const userId = decoded.userId;

        const departmentIds = await getVisibleDepartmentIds(userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ message: 'No department assigned' }, { status: 403 });
        }

        const body = await req.json();
        const { id: staffReportId, status, score, reviewer_notes } = body;
        if (!staffReportId || !status) {
            return NextResponse.json({ message: 'id and status are required' }, { status: 400 });
        }
        if (status !== 'Completed' && status !== 'Returned') {
            return NextResponse.json({ message: 'status must be Completed or Returned' }, { status: 400 });
        }
        if (status === 'Completed' && (score == null || score < 1 || score > 5)) {
            return NextResponse.json({ message: 'Score 1-5 is required when marking Completed' }, { status: 400 });
        }

        const placeholders = inPlaceholders(departmentIds.length);
        const reportCheck = await query({
            query: `
                SELECT sr.id, sr.activity_assignment_id
                FROM staff_reports sr
                JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                WHERE sr.id = ? AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
            `,
            values: [staffReportId, ...departmentIds, ...departmentIds]
        }) as any[];
        if (reportCheck.length === 0) {
            return NextResponse.json({ message: 'Report not found or unauthorized' }, { status: 403 });
        }

        if (status === 'Returned') {
            await query({
                query: 'UPDATE staff_reports SET status = ? WHERE id = ?',
                values: ['draft', staffReportId]
            });
            // Optionally upsert evaluation with feedback so staff can see why it was returned
            const existing = await query({
                query: 'SELECT id FROM evaluations WHERE staff_report_id = ?',
                values: [staffReportId]
            }) as any[];
            if (existing.length > 0) {
                await query({
                    query: 'UPDATE evaluations SET qualitative_feedback = ?, evaluated_by = ?, evaluation_date = CURRENT_TIMESTAMP WHERE staff_report_id = ?',
                    values: [reviewer_notes || '', userId, staffReportId]
                });
            } else {
                await query({
                    query: `
                        INSERT INTO evaluations (staff_report_id, evaluated_by, qualitative_feedback, metrics_achieved, metrics_target, created_at)
                        VALUES (?, ?, ?, 0, 5, CURRENT_TIMESTAMP)
                    `,
                    values: [staffReportId, userId, reviewer_notes || '']
                });
            }
            return NextResponse.json({ message: 'Submission returned for revision' });
        }

        // Completed: set staff_reports.status = 'evaluated', insert/update evaluations
        await query({
            query: 'UPDATE staff_reports SET status = ? WHERE id = ?',
            values: ['evaluated', staffReportId]
        });

        const rating = ratingFromScore(Number(score));
        const metricsAchieved = Number(score);
        const metricsTarget = 5;

        const existingEval = await query({
            query: 'SELECT id FROM evaluations WHERE staff_report_id = ?',
            values: [staffReportId]
        }) as any[];

        if (existingEval.length > 0) {
            await query({
                query: `
                    UPDATE evaluations SET evaluated_by = ?, evaluation_date = CURRENT_TIMESTAMP,
                    qualitative_feedback = ?, metrics_achieved = ?, metrics_target = ?, rating = ?
                    WHERE staff_report_id = ?
                `,
                values: [userId, reviewer_notes || '', metricsAchieved, metricsTarget, rating, staffReportId]
            });
        } else {
            await query({
                query: `
                    INSERT INTO evaluations (staff_report_id, evaluated_by, qualitative_feedback, metrics_achieved, metrics_target, rating, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `,
                values: [staffReportId, userId, reviewer_notes || '', metricsAchieved, metricsTarget, rating]
            });
        }

        return NextResponse.json({ message: 'Evaluation submitted successfully' });
    } catch (error: any) {
        console.error('Department Evaluations PUT Error:', error);
        return NextResponse.json(
            { message: error.message || 'Error submitting evaluation', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
