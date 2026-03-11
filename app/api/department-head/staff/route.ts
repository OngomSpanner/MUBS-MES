import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

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

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ staff: [], alerts: [] });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        const staff = await query({
            query: `
                SELECT 
                    u.id,
                    u.full_name,
                    u.email,
                    u.position,
                    u.leave_status,
                    u.contract_end_date,
                    (SELECT COUNT(*) FROM activity_assignments WHERE assigned_to_user_id = u.id AND status NOT IN ('completed')) as active_tasks
                FROM users u
                WHERE u.department_id IN (${placeholders})
                AND u.role NOT LIKE '%Admin%' AND u.role NOT LIKE '%Principal%'
            `,
            values: [...departmentIds]
        }) as any[];

        // HR Alerts
        const alerts = staff.filter((s: any) =>
            s.leave_status !== 'On Duty' ||
            (s.contract_end_date && new Date(s.contract_end_date).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000)
        ).map((s: any) => ({
            id: s.id,
            name: s.full_name,
            position: s.position,
            type: s.leave_status !== 'On Duty' ? 'Leave' : 'Contract',
            message: s.leave_status !== 'On Duty' ? `On ${s.leave_status}` : `Expires on ${new Date(s.contract_end_date).toLocaleDateString()}`,
            daysRemaining: s.contract_end_date ? Math.ceil((new Date(s.contract_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null,
            activeTasks: s.active_tasks
        }));

        return NextResponse.json({
            staff,
            alerts
        });
    } catch (error: any) {
        console.error('Department Staff API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department staff', detail: error.message },
            { status: 500 }
        );
    }
}
