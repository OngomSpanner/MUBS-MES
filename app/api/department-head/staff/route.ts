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
                    COALESCE(u.leave_status, 'On Duty') AS leave_status,
                    COALESCE(u.contract_end_date, u.contract_end) AS contract_end_date,
                    u.employee_id,
                    u.employment_status,
                    u.contract_type,
                    u.staff_category,
                    u.contract_start_date,
                    u.status AS account_status,
                    (
                        (
                            SELECT COUNT(*) FROM activity_assignments aa_cnt
                            WHERE aa_cnt.assigned_to_user_id = u.id
                            AND LOWER(TRIM(COALESCE(aa_cnt.status, ''))) NOT IN ('completed', 'evaluated', 'not_done')
                        )
                        + (
                            SELECT COUNT(*) FROM staff_process_assignments spa_cnt
                            WHERE spa_cnt.staff_id = u.id
                            AND LOWER(TRIM(COALESCE(spa_cnt.status, ''))) NOT IN ('evaluated', 'completed', 'not_done')
                        )
                    ) AS active_tasks
                FROM users u
                WHERE u.department_id IN (${placeholders})
                ORDER BY u.full_name ASC
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
