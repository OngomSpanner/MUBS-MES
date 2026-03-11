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

        // Tasks: strategic_activities (child) in visible departments or whose parent is in visible departments
        const tasksQuery = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    COALESCE(aa.status, sa.status) as db_status,
                    sa.priority,
                    sa.progress,
                    sa.end_date as dueDate,
                    u.full_name as assignee_name,
                    aa.assigned_to_user_id as assigned_to,
                    p.id as activity_id,
                    p.title as activity_title,
                    sa.description
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN activity_assignments aa ON aa.activity_id = sa.id
                LEFT JOIN users u ON aa.assigned_to_user_id = u.id
                LEFT JOIN staff_reports sr ON sr.activity_assignment_id = aa.id
                WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}))
                AND sa.parent_id IS NOT NULL
                ORDER BY sa.priority DESC, sa.end_date ASC
            `,
            values: [...departmentIds, ...departmentIds]
        }) as any[];

        const statusMap: Record<string, string> = {
            'pending': 'Pending',
            'accepted': 'Pending',
            'in_progress': 'In Progress',
            'submitted': 'Under Review',
            'evaluated': 'Completed',
            'completed': 'Completed',
            'overdue': 'Delayed'
        };

        const tasks = tasksQuery.map((t: any) => ({
            ...t,
            status: statusMap[t.db_status] || 'Not Started'
        }));

        const kanban = {
            todo: tasks.filter((t: any) => ['Not Started', 'Pending'].includes(t.status)),
            inProgress: tasks.filter((t: any) => ['In Progress', 'On Track', 'Delayed'].includes(t.status)),
            underReview: tasks.filter((t: any) => t.status === 'Under Review'),
            completed: tasks.filter((t: any) => t.status === 'Completed')
        };

        const activitiesQuery = await query({
            query: `SELECT id, title FROM strategic_activities WHERE department_id IN (${placeholders}) AND parent_id IS NULL ORDER BY title`,
            values: [...departmentIds]
        }) as any[];

        const activities = activitiesQuery.map((a: any) => ({ id: a.id, title: a.title }));
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

        const { title, parent_id, assigned_to, end_date, priority, description } = body;

        if (!title || !parent_id || !end_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // HOD cannot assign tasks to themselves; only to staff
        if (role === 'hod' && assigned_to != null && Number(assigned_to) === userId) {
            return NextResponse.json({ message: 'You cannot assign a task to yourself. Assign to a staff member.' }, { status: 403 });
        }

        const placeholders = inPlaceholders(departmentIds.length);
        const parentCheck = await query({
            query: `SELECT id, department_id FROM strategic_activities WHERE id = ? AND department_id IN (${placeholders}) AND parent_id IS NULL`,
            values: [parent_id, ...departmentIds]
        }) as any[];

        if (parentCheck.length === 0) {
            return NextResponse.json({ message: 'Invalid parent activity for your department' }, { status: 403 });
        }

        const parentDeptId = parentCheck[0].department_id;

        const result = await query({
            query: `
                INSERT INTO strategic_activities 
                (title, parent_id, department_id, end_date, priority, description, status, progress, created_by, activity_type) 
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, 'detailed')
            `,
            values: [
                title,
                parent_id,
                parentDeptId,
                end_date,
                priority || 'Medium',
                description || '',
                userId
            ]
        }) as any;

        const insertedTaskId = result.insertId;

        // If assigned, create assignment
        if (assigned_to) {
            await query({
                query: `
                    INSERT INTO activity_assignments
                    (activity_id, assigned_to_user_id, assigned_by, start_date, end_date, status)
                    VALUES (?, ?, ?, CURDATE(), ?, 'pending')
                `,
                values: [insertedTaskId, assigned_to, userId, end_date]
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

        const { id, title, assigned_to, end_date, priority, description, status, progress, reviewer_notes, score } = body;

        if (!id) {
            return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
        }

        // HOD cannot assign tasks to themselves; only to staff
        if (role === 'hod' && assigned_to != null && Number(assigned_to) === userId) {
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

        // First update the strategic activity
        let updateQuery = 'UPDATE strategic_activities SET updated_at = CURRENT_TIMESTAMP';
        const saValues: any[] = [];

        if (title !== undefined) { updateQuery += ', title = ?'; saValues.push(title); }
        if (end_date !== undefined) { updateQuery += ', end_date = ?'; saValues.push(end_date); }
        if (priority !== undefined) { updateQuery += ', priority = ?'; saValues.push(priority); }
        if (description !== undefined) { updateQuery += ', description = ?'; saValues.push(description); }
        if (progress !== undefined) { updateQuery += ', progress = ?'; saValues.push(progress); }

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
                        VALUES (?, ?, ?, CURDATE(), ?, 'pending')
                    `,
                    values: [id, assigned_to, userId, end_date || null]
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
