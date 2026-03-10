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

        // Dynamically fetch department_id for this HOD
        const userRec = await query({
            query: 'SELECT department FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as any[];

        if (!userRec.length || !userRec[0].department) {
            return NextResponse.json({ submissions: [], stats: { pending: 0, underReview: 0, reviewed: 0, returned: 0 }, recentActivity: [] });
        }

        const departmentMapped = await query({
            query: 'SELECT id FROM departments WHERE name = ?',
            values: [userRec[0].department]
        }) as any[];

        const departmentId = departmentMapped.length > 0 ? departmentMapped[0].id : 0;

        // Fetch submissions (activities/tasks with 'Under Review' status or from tracking)
        const submissions = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title as report_name,
                    p.title as activity_title,
                    u.full_name as staff_name,
                    sa.updated_at as submitted_at,
                    sa.status,
                    sa.progress,
                    sa.score,
                    sa.description,
                    sa.reviewer_notes
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN users u ON sa.assigned_to = u.id
                WHERE (sa.department_id = ? OR p.department_id = ?)
                AND sa.status IN ('Under Review', 'Pending', 'Completed', 'Returned')
                ORDER BY sa.updated_at DESC
            `,
            values: [departmentId, departmentId]
        }) as any[];

        // Stats
        const stats = {
            pending: submissions.filter(s => s.status === 'Pending').length,
            underReview: submissions.filter(s => s.status === 'Under Review').length,
            reviewed: submissions.filter(s => s.status === 'Completed').length,
            returned: submissions.filter(s => s.status === 'Returned').length
        };

        // Recent activity
        const recentActivity = submissions.slice(0, 5).map(s => ({
            id: s.id,
            type: s.status,
            message: `${s.report_name} ${s.status === 'Pending' ? 'submitted' : s.status.toLowerCase()} by ${s.staff_name}`,
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
