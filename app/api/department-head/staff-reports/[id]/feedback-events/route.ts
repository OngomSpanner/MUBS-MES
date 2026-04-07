import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

/** Append-only feedback timeline for a staff report (HOD process submissions). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const reportId = parseInt(id, 10);
        if (Number.isNaN(reportId)) {
            return NextResponse.json({ message: 'Invalid report id' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const decoded = verifyToken(token) as { userId?: number } | null;
        if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ events: [] });
        }
        const placeholders = inPlaceholders(departmentIds.length);

        const access = await query({
            query: `
                SELECT sr.id
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN staff_process_assignments spa ON sr.process_assignment_id = spa.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                WHERE sr.id = ?
                AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}) OR psa_sa.department_id IN (${placeholders}))
            `,
            values: [reportId, ...departmentIds, ...departmentIds, ...departmentIds],
        }) as { id: number }[];

        if (access.length === 0) {
            return NextResponse.json({ message: 'Not found' }, { status: 404 });
        }

        try {
            const events = (await query({
                query: `
                    SELECT e.body, e.created_at, u.full_name AS author_name
                    FROM submission_feedback_events e
                    LEFT JOIN users u ON e.author_user_id = u.id
                    WHERE e.staff_report_id = ?
                    ORDER BY e.created_at ASC, e.id ASC
                `,
                values: [reportId],
            })) as { body: string; created_at: string; author_name: string | null }[];

            return NextResponse.json({ events });
        } catch {
            return NextResponse.json({ events: [] });
        }
    } catch (error: unknown) {
        console.error('feedback-events GET:', error);
        return NextResponse.json({ events: [] });
    }
}
