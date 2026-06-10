import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { ensureDepartmentSectionTables } from '@/lib/department-sections';

type DecodedToken = {
    userId?: number;
};

type StaffRow = {
    id: number;
    department_id: number;
    full_name: string;
    email: string;
    position: string | null;
    leave_status: string;
    contract_end_date: string | null;
    employee_id?: string | null;
    employment_status?: string | null;
    contract_type?: string | null;
    staff_category?: string | null;
    contract_start_date?: string | null;
    account_status?: string | null;
    gender?: string | null;
    nationality?: string | null;
    designation_grade?: string | null;
    date_of_birth?: string | null;
    date_first_appointment?: string | null;
    date_current_appointment?: string | null;
    date_office_assignment?: string | null;
    retirement_date?: string | null;
    disability_status?: string | null;
    disability_type?: string | null;
    workplace_accommodation?: string | null;
    special_support_needs?: string | null;
    faculty_office?: string | null;
    department?: string;
    active_tasks: number;
    sections_concat?: string | null;
};

export async function GET() {
    try {
        await ensureDepartmentSectionTables();

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as DecodedToken | null;
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
                    u.department_id,
                    u.full_name,
                    u.email,
                    u.position,
                    COALESCE(u.leave_status, 'On Duty') AS leave_status,
                    COALESCE(u.contract_end_date, u.contract_end) AS contract_end_date,
                    u.employee_id,
                    u.employment_status,
                    u.contract_type,
                    u.staff_category,
                    COALESCE(u.contract_start_date, u.contract_start) AS contract_start_date,
                    u.status AS account_status,
                    u.gender,
                    u.nationality,
                    u.designation_grade,
                    DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
                    DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
                    DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
                    DATE_FORMAT(u.date_office_assignment, '%Y-%m-%d') AS date_office_assignment,
                    DATE_FORMAT(u.retirement_date, '%Y-%m-%d') AS retirement_date,
                    u.disability_status,
                    u.disability_type,
                    u.workplace_accommodation,
                    u.special_support_needs,
                    u.faculty_office,
                    COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department,
                    GROUP_CONCAT(DISTINCT CONCAT(ds.id, ':', ds.name) ORDER BY ds.name SEPARATOR '||') AS sections_concat,
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
                LEFT JOIN departments d ON d.id = u.department_id
                LEFT JOIN department_section_staff dss ON dss.staff_user_id = u.id
                LEFT JOIN department_sections ds ON ds.id = dss.section_id
                WHERE u.department_id IN (${placeholders})
                GROUP BY
                    u.id,
                    u.department_id,
                    u.full_name,
                    u.email,
                    u.position,
                    leave_status,
                    contract_end_date,
                    u.employee_id,
                    u.employment_status,
                    u.contract_type,
                    u.staff_category,
                    contract_start_date,
                    account_status,
                    u.gender,
                    u.nationality,
                    u.designation_grade,
                    date_of_birth,
                    date_first_appointment,
                    date_current_appointment,
                    date_office_assignment,
                    retirement_date,
                    u.disability_status,
                    u.disability_type,
                    u.workplace_accommodation,
                    u.special_support_needs,
                    u.faculty_office,
                    department
                ORDER BY u.full_name ASC
            `,
            values: [...departmentIds]
        }) as StaffRow[];

        const normalizedStaff: Array<StaffRow & { sections: Array<{ id: number; name: string }> }> = (
            staff as unknown as Array<Record<string, unknown>>
        ).map((row) => {
            let sections: Array<{ id: number; name: string }> = [];
            const rawConcat = typeof row.sections_concat === 'string' ? row.sections_concat : '';
            if (rawConcat) {
                sections = rawConcat
                    .split('||')
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .map((part) => {
                        const idx = part.indexOf(':');
                        if (idx <= 0) return null;
                        const id = Number(part.slice(0, idx));
                        const name = part.slice(idx + 1).trim();
                        if (!Number.isFinite(id) || !name) return null;
                        return { id, name };
                    })
                    .filter((s): s is { id: number; name: string } => s != null);
            }

            const typed = row as StaffRow;
            return {
                ...typed,
                department: (typed.department || '').trim() || '—',
                sections,
            };
        });

        // HR Alerts
        const alerts = normalizedStaff.filter((s) =>
            s.leave_status !== 'On Duty' ||
            (s.contract_end_date && new Date(s.contract_end_date).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000)
        ).map((s) => ({
            id: s.id,
            name: s.full_name,
            position: s.position,
            type: s.leave_status !== 'On Duty' ? 'Leave' : 'Contract',
            message:
                s.leave_status !== 'On Duty'
                    ? `On ${s.leave_status}`
                    : `Expires on ${s.contract_end_date ? new Date(s.contract_end_date).toLocaleDateString() : '—'}`,
            daysRemaining: s.contract_end_date ? Math.ceil((new Date(s.contract_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null,
            activeTasks: s.active_tasks
        }));

        return NextResponse.json({
            staff: normalizedStaff,
            alerts
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Department Staff API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department staff', detail: message },
            { status: 500 }
        );
    }
}
