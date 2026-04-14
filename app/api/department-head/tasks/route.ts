import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

async function getAuthFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) throw new Error('Unauthorized');
    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) throw new Error('Invalid token');
    const departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) throw new Error('User has no department assigned. Please contact the administrator.');
    return { departmentIds, userId: decoded.userId, role: (decoded.role || '').toLowerCase() };
}

export async function GET() {
    try {
        const { departmentIds, userId } = await getAuthFromToken();
        const placeholders = inPlaceholders(departmentIds.length);

        // Two-tier flat: Weekly Tasks (strategic_activities with parent_id set) linked to one Strategic Activity (parent_id IS NULL).
        // Progress = strategic_activities.progress, same scale as Department Efficiency: Complete=100%, Incomplete=50%, Not Done=0% (set when HOD evaluates in Submissions).
        let tasksQuery: any[];
        try {
            tasksQuery = await query({
                query: `
                    SELECT 
                        sa.id,
                        sa.title,
                        COALESCE(aa.status, sa.status) as db_status,
                        sa.progress,
                        (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.activity_assignment_id = aa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                        COALESCE(sa.start_date, p.start_date) as startDate,
                        COALESCE(sa.end_date, p.end_date) as endDate,
                        COALESCE(sa.end_date, p.end_date) as dueDate,
                        u.full_name as assignee_name,
                        aa.assigned_to_user_id as assigned_to,
                        COALESCE(p.id, sa.id) as activity_id,
                        COALESCE(p.title, '') as activity_title,
                        sa.description,
                        sa.task_type,
                        sa.kpi_target_value,
                        sa.frequency,
                        sa.frequency_interval
                    FROM strategic_activities sa
                    LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                    LEFT JOIN activity_assignments aa ON aa.activity_id = sa.id
                    LEFT JOIN users u ON aa.assigned_to_user_id = u.id
                    LEFT JOIN staff_reports sr ON sr.activity_assignment_id = aa.id
                    WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
                    AND (sa.parent_id IS NOT NULL OR (sa.parent_id IS NULL AND (sa.task_type = 'process' OR sa.task_type IS NULL)))
                    AND sa.activity_type = 'detailed'
                    AND (COALESCE(sa.source, '') != 'strategic_plan')
                    ORDER BY sa.end_date ASC
                `,
                values: [...departmentIds, ...departmentIds]
            }) as any[];
        } catch (err: any) {
            if (err?.message?.includes('task_type') || err?.code === 'ER_BAD_FIELD_ERROR') {
                tasksQuery = await query({
                    query: `
                        SELECT sa.id, sa.title, COALESCE(aa.status, sa.status) as db_status, sa.progress,
                        (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.activity_assignment_id = aa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                        COALESCE(sa.start_date, p.start_date) as startDate,
                        COALESCE(sa.end_date, p.end_date) as endDate,
                        COALESCE(sa.end_date, p.end_date) as dueDate,
                        u.full_name as assignee_name, aa.assigned_to_user_id as assigned_to, COALESCE(p.id, sa.id) as activity_id, COALESCE(p.title, '') as activity_title, sa.description, sa.frequency, sa.frequency_interval
                        FROM strategic_activities sa
                        LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                        LEFT JOIN activity_assignments aa ON aa.activity_id = sa.id
                        LEFT JOIN users u ON aa.assigned_to_user_id = u.id
                        LEFT JOIN staff_reports sr ON sr.activity_assignment_id = aa.id
                        WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders})) AND sa.activity_type = 'detailed'
                        AND (COALESCE(sa.source, '') != 'strategic_plan')
                        ORDER BY sa.end_date ASC
                    `,
                    values: [...departmentIds, ...departmentIds]
                }) as any[];
                tasksQuery = tasksQuery.map((t: any) => ({ ...t, task_type: 'process', kpi_target_value: null, latest_report_status: t.latest_report_status }));
            } else {
                throw err;
            }
        }

        let processAssignmentsQuery: any[];
        const processAssignBase = `
                SELECT 
                    spa.id,
                    'process_task' as task_type,
                    sp.step_name as title,
                    sa.title as activity_title,
                    sa.id as activity_id,
                    u.full_name as assignee_name,
                    spa.staff_id as assigned_to,
                    spa.status as db_status,
                    spa.start_date as startDate,
                    spa.end_date as endDate,
                    spa.end_date as dueDate,
                    spa.commentary as description,
                    sp.step_order as step_order,
                    spa.created_at as spa_created_at,
                    (SELECT sr2.status FROM staff_reports sr2 WHERE sr2.process_assignment_id = spa.id ORDER BY sr2.updated_at DESC LIMIT 1) as latest_report_status,
                    st.duration_value as duration_value,
                    st.duration_unit as duration_unit,
                    __PI_COL__
                    0 as progress
                FROM staff_process_assignments spa
                JOIN standard_processes sp ON spa.standard_process_id = sp.id
                JOIN standards st ON sp.standard_id = st.id
                JOIN strategic_activities sa ON spa.activity_id = sa.id
                LEFT JOIN users u ON spa.staff_id = u.id
                WHERE (sa.department_id IN (${placeholders}))
            `;
        try {
            processAssignmentsQuery = (await query({
                query: processAssignBase.replace('__PI_COL__', 'st.performance_indicator,\n                    '),
                values: [...departmentIds],
            })) as any[];
        } catch (e: unknown) {
            const err = e as { code?: string; errno?: number };
            if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
                processAssignmentsQuery = (await query({
                    query: processAssignBase.replace('__PI_COL__', ''),
                    values: [...departmentIds],
                })) as any[];
                processAssignmentsQuery = processAssignmentsQuery.map((row: any) => ({
                    ...row,
                    performance_indicator: null,
                }));
            } else {
                throw e;
            }
        }

        // Subtasks for container process assignments (spa.staff_id IS NULL)
        const containerAssignmentIds = processAssignmentsQuery
            .filter((p: any) => p.assigned_to == null)
            .map((p: any) => Number(p.id))
            .filter((id: number) => Number.isFinite(id) && id > 0);
        const subtasksByAssignmentId = new Map<number, { status: string }[]>();
        if (containerAssignmentIds.length > 0) {
            const paPlaceholders = inPlaceholders(containerAssignmentIds.length);
            try {
                const subRows = (await query({
                    query: `
                        SELECT
                            s.process_assignment_id,
                            COALESCE(
                                (
                                    SELECT sr2.status
                                    FROM staff_reports sr2
                                    WHERE sr2.process_subtask_id = s.id
                                    ORDER BY sr2.updated_at DESC
                                    LIMIT 1
                                ),
                                s.status
                            ) as status
                        FROM staff_process_subtasks s
                        WHERE process_assignment_id IN (${paPlaceholders})
                    `,
                    values: [...containerAssignmentIds],
                })) as any[];
                for (const r of subRows) {
                    const pid = Number(r.process_assignment_id);
                    if (!Number.isFinite(pid) || pid <= 0) continue;
                    const list = subtasksByAssignmentId.get(pid) ?? [];
                    list.push({ status: String(r.status ?? '') });
                    subtasksByAssignmentId.set(pid, list);
                }
            } catch {
                // staff_process_subtasks table may not exist in older schema; ignore
            }
        }

        const statusMap: Record<string, string> = {
            'pending': 'Pending',
            'accepted': 'Pending',
            'in_progress': 'In Progress',
            'submitted': 'Under Review',
            'evaluated': 'Completed',
            'completed': 'Completed',
            'overdue': 'Delayed'
        };

        // Standard process assignments use these status strings
        const processStatusMap: Record<string, string> = {
            pending: 'Pending',
            in_progress: 'In Progress',
            submitted: 'Under Review',
            incomplete: 'Incomplete',
            not_done: 'Not Done',
            completed: 'Completed',
            evaluated: 'Completed',
        };
 
        // Progress and status: same scale as Department Efficiency. Use latest evaluation outcome if present.
        const progressFromReportStatus = (status: string | null): number | null => {
            if (!status) return null;
            const s = (status + '').toLowerCase();
            if (s === 'evaluated') return 100;
            if (s === 'incomplete') return 50;
            if (s === 'not_done') return 0;
            return null;
        };
        const statusFromReportStatus = (status: string | null): string | null => {
            if (!status) return null;
            const s = (status + '').toLowerCase();
            if (s === 'evaluated') return 'Completed';
            if (s === 'incomplete') return 'Incomplete';
            if (s === 'not_done') return 'Not Done';
            return null;
        };

        const mappedTasks = tasksQuery.map((t: any) => {
            const derivedProgress = progressFromReportStatus(t.latest_report_status);
            const progress = derivedProgress != null ? derivedProgress : (t.progress != null ? Number(t.progress) : 0);
            const derivedStatus = statusFromReportStatus(t.latest_report_status);
            const status = derivedStatus ?? statusMap[t.db_status] ?? 'Not Started';
            return {
                ...t,
                progress,
                status,
                strategic_activity_id: t.activity_id,
                tier: 'weekly_task'
            };
        });

        const subtaskProgressFromStatus = (raw: string): number => {
            const s = String(raw || '').toLowerCase();
            if (s === 'completed' || s === 'evaluated') return 100;
            if (s === 'submitted') return 50;
            if (s === 'in_progress') return 25;
            return 0; // pending/accepted/unknown
        };

        const mappedProcessAssignments = processAssignmentsQuery.map((p: any) => {
            const hasWindow = p.startDate != null && String(p.startDate).trim() !== '';
            const isContainer = p.assigned_to == null;

            let status: string;
            let progress: number;

            if (!hasWindow && String(p.db_status || '').toLowerCase() === 'pending') {
                status = 'Not opened';
                progress = 0;
            } else if (isContainer) {
                const subs = subtasksByAssignmentId.get(Number(p.id)) ?? [];
                const total = subs.length;
                const normalized = subs.map((s) => (s.status || '').toLowerCase());
                const completedCount = normalized.filter((s) => s === 'completed' || s === 'evaluated').length;

                // Parent progress = average of subtask progress (100% only when all done)
                const sum = normalized.reduce((acc, s) => acc + subtaskProgressFromStatus(s), 0);
                progress = total > 0 ? Math.round(sum / total) : 0;

                // Container status must be derived from its subtasks only.
                // Never mark Completed unless ALL subtasks are done (completed/evaluated).
                if (total > 0 && completedCount === total) status = 'Completed';
                else if (normalized.includes('submitted')) status = 'Under Review';
                else if (normalized.includes('incomplete')) status = 'Incomplete';
                else if (normalized.includes('not_done')) status = 'Not Done';
                else if (normalized.some((s) => s === 'in_progress')) status = 'In Progress';
                // 0% progress = not started yet; do not label "In Progress" (matches To do / Not completed tabs)
                else if (progress === 0) status = 'Pending';
                else status = 'In Progress';
            } else {
                const derived = statusFromReportStatus(p.latest_report_status);
                status = derived ?? processStatusMap[p.db_status] ?? 'Pending';
                // Do not use 50% for "In Progress" (just opened / staff working)—only for Under Review or HOD evaluation outcomes.
                const derivedProgress = progressFromReportStatus(p.latest_report_status);
                progress =
                    status === 'Completed'
                        ? 100
                        : derivedProgress != null
                          ? derivedProgress
                          : status === 'Under Review'
                            ? 50
                            : 0;
            }
            return {
                ...p,
                status,
                progress,
                strategic_activity_id: p.activity_id,
                tier: 'process_task',
            };
        });

        const allTasksCombined = [...mappedTasks, ...mappedProcessAssignments];

        // One row per task per assignee
        const seen = new Map<string, typeof allTasksCombined[0]>();
        for (const t of allTasksCombined) {
            const key = `${t.tier}-${t.id}-${t.assigned_to ?? 'unassigned'}`;
            const existing = seen.get(key);
            if (!existing || t.status === 'Completed' || (t.status === 'Under Review' && existing.status !== 'Completed')) {
                seen.set(key, t);
            }
        }
        const tasks = Array.from(seen.values()).sort((a: any, b: any) => {
            const aid = Number(a.activity_id) || 0;
            const bid = Number(b.activity_id) || 0;
            if (aid !== bid) return aid - bid;
            const aProc = a.tier === 'process_task';
            const bProc = b.tier === 'process_task';
            if (aProc && bProc) {
                const so = (Number(a.step_order) || 0) - (Number(b.step_order) || 0);
                if (so !== 0) return so;
                const ta = new Date(a.spa_created_at || 0).getTime();
                const tb = new Date(b.spa_created_at || 0).getTime();
                if (ta !== tb) return ta - tb;
            } else if (aProc !== bProc) {
                return aProc ? -1 : 1;
            }
            return (Number(a.id) || 0) - (Number(b.id) || 0);
        });

        const kanban = {
            todo: tasks.filter((t: any) => ['Not Started', 'Pending', 'Not opened'].includes(t.status)),
            inProgress: tasks.filter((t: any) => ['In Progress', 'On Track', 'Delayed', 'Incomplete', 'Not Done'].includes(t.status)),
            underReview: tasks.filter((t: any) => t.status === 'Under Review'),
            completed: tasks.filter((t: any) => t.status === 'Completed')
        };

        // Parent options for HOD: top-level strategic goals or strategy-plan detailed copies in this exactly matched department
        const activitiesQuery = await query({
            query: `SELECT id, title, kpi_target_value, target_kpi FROM strategic_activities WHERE department_id = ? AND (parent_id IS NULL OR source = 'strategic_plan') AND COALESCE(TRIM(source), '') <> '' ORDER BY title`,
            values: [departmentIds[0]]
        }) as any[];

        const activities = activitiesQuery.map((a: any) => ({ 
            id: a.id, 
            title: a.title, 
            kpi_target_value: a.kpi_target_value,
            target_kpi: a.target_kpi
        }));
        const filterActivityNames = activitiesQuery.map((a: any) => a.title);
        const assignees = [...new Set(tasks.map((t: any) => t.assignee_name))].filter(Boolean);

        return NextResponse.json({
            kanban,
            availableActivities: activities,
            filters: {
                activities: filterActivityNames,
                assignees
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Error fetching department tasks', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const { departmentIds, userId, role } = await getAuthFromToken();
        const body = await req.json();

        const { title, parent_id, assigned_to, assigned_to_ids, end_date, start_date, description, task_type, kpi_target_value, frequency, frequency_interval } = body;

        if (!title || !end_date) {
            return NextResponse.json({ message: 'Missing required fields (title, end_date)' }, { status: 400 });
        }

        const taskType = task_type === 'kpi_driver' ? 'kpi_driver' : 'process';
        const isKpiDriver = taskType === 'kpi_driver';

        if (isKpiDriver && (parent_id == null || parent_id === '')) {
            return NextResponse.json({ message: 'KPI-Driver Task (Strategy Plan) requires a Parent Strategic Activity.' }, { status: 400 });
        }

        // Support single (assigned_to) or multiple (assigned_to_ids) assignees
        // Accept arrays, comma-separated strings, or array-like objects with an id field.
        const idsFromList: number[] = (() => {
            if (Array.isArray(assigned_to_ids)) {
                return assigned_to_ids
                    .map((x: unknown) => {
                        if (typeof x === 'object' && x !== null && 'id' in (x as Record<string, unknown>)) {
                            return Number((x as Record<string, unknown>).id);
                        }
                        return Number(x);
                    })
                    .filter((x) => !Number.isNaN(x) && x > 0);
            }
            if (typeof assigned_to_ids === 'string') {
                return assigned_to_ids
                    .split(',')
                    .map((s: string) => Number(s.trim()))
                    .filter((x) => !Number.isNaN(x) && x > 0);
            }
            return [];
        })();
        const rawIds: number[] = idsFromList.length > 0
            ? idsFromList
            : (assigned_to != null && assigned_to !== '' ? [Number(assigned_to)] : []).filter((x) => !Number.isNaN(x) && x > 0);
        const assigneeUserIds = [...new Set(rawIds)];

        // HOD / Unit Head cannot assign tasks to themselves; only to staff
        const filteredAssigneeIds = (role === 'hod' || role === 'unit head')
            ? assigneeUserIds.filter((id) => id !== userId)
            : assigneeUserIds;

        // If client attempted assignment but no valid assignee survived parsing/filtering, fail fast.
        if ((assigned_to_ids !== undefined || assigned_to !== undefined) && filteredAssigneeIds.length === 0) {
            return NextResponse.json(
                { message: 'Select at least one valid staff assignee (not your own account).' },
                { status: 400 }
            );
        }

        const placeholders = inPlaceholders(departmentIds.length);
        let parentDeptId: number;
        let effectiveParentId: number | null = null;

        if (parent_id != null && parent_id !== '') {
            const parentCheck = await query({
                query: `
                    SELECT 
                        sa.id,
                        sa.department_id,
                        sa.parent_id,
                        COALESCE(p.id, sa.id) as main_id,
                        COALESCE(p.department_id, sa.department_id) as main_department_id
                    FROM strategic_activities sa
                    LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                    WHERE sa.id = ?
                    AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
                    AND (sa.parent_id IS NULL OR COALESCE(sa.source, '') = 'strategic_plan')
                `,
                values: [parent_id, ...departmentIds, ...departmentIds]
            }) as any[];
            if (parentCheck.length === 0) {
                return NextResponse.json({ message: 'Invalid parent activity for your department' }, { status: 403 });
            }
            const row = parentCheck[0];
            // Tasks should live in the HOD's unit; parent_id must point to the top-level strategic activity.
            parentDeptId = Number(row.department_id ?? row.main_department_id);
            effectiveParentId = Number(row.main_id);
        } else {
            parentDeptId = departmentIds[0];
        }

        const kpiTarget = isKpiDriver && kpi_target_value != null && kpi_target_value !== ''
            ? Number(kpi_target_value)
            : null;

        // Schema (mubs_super_admin): activity_type, task_type, parent_id, title, description, department_id, start_date, end_date, status, progress, created_by, kpi_target_value
        const startDate = (start_date && start_date !== '') ? start_date : null;
        let result: any;
        try {
            result = await query({
                query: `
                    INSERT INTO strategic_activities 
                    (activity_type, task_type, parent_id, title, description, department_id, start_date, end_date, status, progress, created_by, kpi_target_value, frequency, frequency_interval) 
                    VALUES ('detailed', ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)
                `,
                values: [
                    taskType,
                    effectiveParentId,
                    title,
                    description || '',
                    parentDeptId,
                    startDate,
                    end_date,
                    userId,
                    kpiTarget,
                    frequency || 'once',
                    frequency_interval || 1
                ]
            }) as any;
        } catch (insertErr: any) {
            if (insertErr?.message?.includes('task_type') || insertErr?.code === 'ER_BAD_FIELD_ERROR') {
                result = await query({
                    query: `
                        INSERT INTO strategic_activities 
                        (activity_type, parent_id, title, description, department_id, start_date, end_date, status, progress, created_by) 
                        VALUES ('detailed', ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
                    `,
                    values: [effectiveParentId, title, description || '', parentDeptId, startDate, end_date, userId]
                }) as any;
            } else {
                throw insertErr;
            }
        }

        const insertedTaskId = result.insertId;

        // Create one assignment per selected staff member
        for (const assignedToId of filteredAssigneeIds) {
            await query({
                query: `
                    INSERT INTO activity_assignments
                    (activity_id, assigned_to_user_id, assigned_by, start_date, end_date, status)
                    VALUES (?, ?, ?, ?, ?, 'pending')
                `,
                values: [insertedTaskId, assignedToId, userId, startDate, end_date]
            });
        }

        return NextResponse.json({ message: 'Task created successfully', id: insertedTaskId });

    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Error creating task', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function PUT(req: Request) {
    try {
        const { departmentIds, userId, role } = await getAuthFromToken();
        const body = await req.json();

        const { id, title, assigned_to, end_date, start_date, description, status, progress, reviewer_notes, score, task_type, kpi_target_value, parent_id, activity_id, frequency, frequency_interval } = body;

        if (!id) {
            return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
        }

        // HOD / Unit Head cannot assign tasks to themselves; only to staff
        if ((role === 'hod' || role === 'unit head') && assigned_to != null && Number(assigned_to) === userId) {
            return NextResponse.json({ message: 'You cannot assign a task to yourself. Assign to a staff member.' }, { status: 403 });
        }

        const placeholders = inPlaceholders(departmentIds.length);
        const taskCheck = await query({
            query: `
                SELECT sa.id 
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                WHERE sa.id = ? AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
            `,
            values: [id, ...departmentIds, ...departmentIds]
        }) as any[];

        if (taskCheck.length === 0) {
            return NextResponse.json({ message: 'Task not found or unauthorized' }, { status: 403 });
        }

        const taskType = task_type !== undefined ? (task_type === 'kpi_driver' ? 'kpi_driver' : 'process') : undefined;
        const isKpiDriver = taskType === 'kpi_driver';
        const pId = parent_id ?? activity_id;

        if (isKpiDriver && (pId == null || pId === '')) {
            return NextResponse.json({ message: 'KPI-Driver Task (Strategy Plan) requires a Parent Strategic Activity.' }, { status: 400 });
        }

        let effectiveParentId: number | null | undefined = undefined;
        if (pId !== undefined) {
            if (pId == null || pId === '') {
                effectiveParentId = null;
            } else {
                const parentCheck = await query({
                    query: `
                        SELECT 
                            COALESCE(p.id, sa.id) as main_id
                        FROM strategic_activities sa
                        LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                        WHERE sa.id = ?
                        AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
                        AND (sa.parent_id IS NULL OR COALESCE(sa.source, '') = 'strategic_plan')
                    `,
                    values: [pId, ...departmentIds, ...departmentIds]
                }) as any[];
                if (parentCheck.length === 0) {
                    return NextResponse.json({ message: 'Invalid parent activity for your department' }, { status: 403 });
                }
                effectiveParentId = Number(parentCheck[0].main_id);
            }
        } else if (taskType === 'process') {
            effectiveParentId = null;
        }

        // First update the strategic activity
        let updateQuery = 'UPDATE strategic_activities SET updated_at = CURRENT_TIMESTAMP';
        const saValues: any[] = [];

        if (title !== undefined) { updateQuery += ', title = ?'; saValues.push(title); }
        if (start_date !== undefined) { updateQuery += ', start_date = ?'; saValues.push(start_date); }
        if (end_date !== undefined) { updateQuery += ', end_date = ?'; saValues.push(end_date); }

        if (description !== undefined) { updateQuery += ', description = ?'; saValues.push(description); }
        if (progress !== undefined) { updateQuery += ', progress = ?'; saValues.push(progress); }
        if (taskType !== undefined) { updateQuery += ', task_type = ?'; saValues.push(taskType); }
        if (effectiveParentId !== undefined) { updateQuery += ', parent_id = ?'; saValues.push(effectiveParentId); }
        if (kpi_target_value !== undefined) { updateQuery += ', kpi_target_value = ?'; saValues.push(kpi_target_value === '' || kpi_target_value == null ? null : Number(kpi_target_value)); }
        if (frequency !== undefined) { updateQuery += ', frequency = ?'; saValues.push(frequency); }
        if (frequency_interval !== undefined) { updateQuery += ', frequency_interval = ?'; saValues.push(frequency_interval); }

        updateQuery += ' WHERE id = ?';
        saValues.push(id);

        await query({ query: updateQuery, values: saValues });

        // When marking as Completed, also set the child strategic_activity to completed so dashboard progress reflects it
        if (status === 'Completed') {
            await query({
                query: 'UPDATE strategic_activities SET status = ?, progress = 100 WHERE id = ?',
                values: ['completed', id]
            });
        }

        // Then update activity assignments if changed
        if (assigned_to !== undefined || status !== undefined) {
            // check if assignment exists
            const aaCheck = await query({
                query: 'SELECT id FROM activity_assignments WHERE activity_id = ?',
                values: [id]
            }) as any[];

            if (aaCheck.length > 0) {
                // update
                let aaUpdateQuery = 'UPDATE activity_assignments SET status = status';
                const aaValues: any[] = [];
                if (assigned_to !== undefined) { aaUpdateQuery += ', assigned_to_user_id = ?'; aaValues.push(assigned_to); }
                if (status !== undefined) { 
                    const statusReverseMap: Record<string, string> = {
                        'Pending': 'pending',
                        'In Progress': 'in_progress',
                        'Under Review': 'submitted',
                        'Completed': 'completed'
                    };
                    aaUpdateQuery += ', status = ?'; aaValues.push(statusReverseMap[status] || 'pending'); 
                }
                aaUpdateQuery += ' WHERE activity_id = ?';
                aaValues.push(id);
                await query({ query: aaUpdateQuery, values: aaValues });
            } else if (assigned_to) {
                // insert
                await query({
                    query: `
                        INSERT INTO activity_assignments
                        (activity_id, assigned_to_user_id, assigned_by, start_date, end_date, status)
                        VALUES (?, ?, ?, ?, ?, 'pending')
                    `,
                    values: [id, assigned_to, userId, start_date || null, end_date || null]
                });
            }
        }

        // If reviewer_notes or score is provided, we might need to update the evaluation or staff report.
        // Usually, that happens on the Evaluations/Submissions page, not the generic tasks list, so we skip it here.

        return NextResponse.json({ message: 'Task updated successfully' });

    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Error updating task', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
