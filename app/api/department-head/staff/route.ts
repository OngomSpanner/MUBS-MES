import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const departmentName = 'Faculty of Computing and Informatics';

        // Fetch all staff for the department
        const staff = await query({
            query: `
                SELECT 
                    u.id,
                    u.full_name,
                    u.email,
                    u.role,
                    u.leave_status,
                    u.contract_end_date,
                    (SELECT COUNT(*) FROM strategic_activities WHERE assigned_to = u.id AND status != 'Completed') as active_tasks
                FROM users u
                WHERE u.department = ?
                AND u.role != 'Admin' AND u.role != 'Principal'
            `,
            values: [departmentName]
        }) as any[];

        // HR Alerts
        const alerts = staff.filter(s =>
            s.leave_status !== 'On Duty' ||
            (s.contract_end_date && new Date(s.contract_end_date).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000)
        ).map(s => ({
            id: s.id,
            name: s.full_name,
            role: s.role,
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
