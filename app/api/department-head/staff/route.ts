import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { ensureDepartmentSectionTables } from '@/lib/department-sections';
import { computeWorkloadStatus, WORKLOAD_STATUS_LABELS } from '@/lib/hod-workload';

type DecodedToken = {
    userId?: number;
};

type StaffRow = {
    id: number;
    department_id: number;
    full_name: string;
    position: string | null;
    designation_grade: string | null;
    staff_category: string | null;
    department?: string;
    active_tasks: number;
    overdue_incomplete: number;
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
            return NextResponse.json({ staff: [], workloadAlerts: [] });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        const staff = (await query({
            query: `
                SELECT 
                    u.id,
                    u.department_id,
                    u.full_name,
                    u.position,
                    u.designation_grade,
                    u.staff_category,
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
                    ) AS active_tasks,
                    (
                        (
                            SELECT COUNT(*) FROM activity_assignments aa_od
                            WHERE aa_od.assigned_to_user_id = u.id
                            AND aa_od.end_date IS NOT NULL AND aa_od.end_date < CURDATE()
                            AND LOWER(TRIM(COALESCE(aa_od.status, ''))) NOT IN ('completed', 'evaluated', 'not_done')
                        )
                        + (
                            SELECT COUNT(*) FROM staff_process_assignments spa_od
                            WHERE spa_od.staff_id = u.id
                            AND spa_od.end_date IS NOT NULL AND spa_od.end_date < CURDATE()
                            AND LOWER(TRIM(COALESCE(spa_od.status, ''))) NOT IN ('evaluated', 'completed', 'not_done')
                        )
                    ) AS overdue_incomplete
                FROM users u
                LEFT JOIN departments d ON d.id = u.department_id
                LEFT JOIN department_section_staff dss ON dss.staff_user_id = u.id
                LEFT JOIN department_sections ds ON ds.id = dss.section_id
                WHERE u.department_id IN (${placeholders})
                  AND u.hrms_staff_id IS NOT NULL
                GROUP BY
                    u.id,
                    u.department_id,
                    u.full_name,
                    u.position,
                    u.designation_grade,
                    u.staff_category,
                    department
                ORDER BY u.full_name ASC
            `,
            values: [...departmentIds],
        })) as StaffRow[];

        const normalizedStaff = staff.map((row) => {
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

            const activeTasks = Number(row.active_tasks ?? 0);
            const overdueIncomplete = Number(row.overdue_incomplete ?? 0);
            const workloadStatus = computeWorkloadStatus(activeTasks, overdueIncomplete);

            return {
                id: row.id,
                department_id: row.department_id,
                full_name: row.full_name,
                position: row.position,
                designation_grade: row.designation_grade,
                staff_category: row.staff_category,
                department: (row.department || '').trim() || '—',
                active_tasks: activeTasks,
                sections,
                workloadStatus,
                workloadLabel: WORKLOAD_STATUS_LABELS[workloadStatus],
            };
        });

        const workloadAlerts = normalizedStaff
            .filter((s) => s.workloadStatus !== 'on_track')
            .map((s) => ({
                id: s.id,
                name: s.full_name,
                position: s.position,
                type: s.workloadStatus,
                message:
                    s.workloadStatus === 'over_allocated'
                        ? `${s.active_tasks} open assignments — consider rebalancing workload.`
                        : s.workloadStatus === 'underutilized'
                          ? 'No open strategic-plan assignments.'
                          : 'Has overdue incomplete assignments.',
                activeTasks: s.active_tasks,
                workloadLabel: s.workloadLabel,
            }));

        return NextResponse.json({
            staff: normalizedStaff,
            workloadAlerts,
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
