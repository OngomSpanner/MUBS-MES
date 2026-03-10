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

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // 1. Get user's department
        const users = await query({
            query: 'SELECT department FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as any[];

        if (users.length === 0 || !users[0].department) {
            return NextResponse.json({ activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } });
        }

        const userDept = users[0].department;

        // 2. Get department ID
        const departments = await query({
            query: 'SELECT id FROM departments WHERE name = ?',
            values: [userDept]
        }) as any[];

        if (departments.length === 0) {
            return NextResponse.json({ activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } });
        }

        const departmentId = departments[0].id;

        // Fetch all activities for the mapped department
        const activities = await query({
            query: `
                SELECT 
                    sa.*,
                    u.name as unit_name,
                    (SELECT COUNT(*) FROM strategic_activities WHERE parent_id = sa.id) as total_tasks,
                    (SELECT COUNT(*) FROM strategic_activities WHERE parent_id = sa.id AND status = 'Completed') as completed_tasks
                FROM strategic_activities sa
                LEFT JOIN departments u ON sa.department_id = u.id
                WHERE sa.department_id = ? AND sa.parent_id IS NULL
                ORDER BY sa.end_date ASC
            `,
            values: [departmentId]
        }) as any[];

        // Calculate stats
        const stats = {
            total: activities.length,
            onTrack: activities.filter(a => a.status === 'On Track').length,
            inProgress: activities.filter(a => a.status === 'In Progress').length,
            delayed: activities.filter(a => a.status === 'Delayed').length
        };

        return NextResponse.json({
            activities,
            stats
        });
    } catch (error: any) {
        console.error('Department Activities API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department activities', detail: error.message },
            { status: 500 }
        );
    }
}
