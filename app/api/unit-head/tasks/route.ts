import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// Helper to get unitId from token
async function getUnitIdFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) throw new Error('Unauthorized');

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) throw new Error('Invalid token');

    const users = await query({
        query: 'SELECT department FROM users WHERE id = ?',
        values: [decoded.userId]
    }) as any[];
    if (users.length === 0 || !users[0].department) throw new Error('User has no department assigned. Please contact the administrator.');

    const desc = users[0].department;
    const units = await query({
        query: 'SELECT id FROM units WHERE name = ?',
        values: [desc]
    }) as any[];

    if (units.length === 0) throw new Error(`Department '${desc}' is not mapped to any unit in the system. Please contact the administrator.`);

    return { unitId: units[0].id, userId: decoded.userId };
}

export async function GET() {
    try {
        const { unitId } = await getUnitIdFromToken();

        const tasks = await query({
            query: `
                SELECT 
                    sa.id,
                    sa.title,
                    sa.status,
                    sa.priority,
                    sa.progress,
                    sa.end_date as dueDate,
                    u.full_name as assignee_name,
                    sa.assigned_to,
                    p.id as activity_id,
                    p.title as activity_title,
                    sa.description,
                    sa.reviewer_notes
                FROM strategic_activities sa
                LEFT JOIN users u ON sa.assigned_to = u.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                WHERE (sa.unit_id = ? OR p.unit_id = ?)
                AND sa.parent_id IS NOT NULL
                ORDER BY sa.priority DESC, sa.end_date ASC
            `,
            values: [unitId, unitId]
        }) as any[];

        const kanban = {
            todo: tasks.filter(t => ['Not Started', 'Pending'].includes(t.status)),
            inProgress: tasks.filter(t => ['In Progress', 'On Track', 'Delayed'].includes(t.status)),
            underReview: tasks.filter(t => t.status === 'Under Review'),
            completed: tasks.filter(t => t.status === 'Completed')
        };

        const activitiesQuery = await query({
            query: 'SELECT id, title FROM strategic_activities WHERE unit_id = ? AND parent_id IS NULL',
            values: [unitId]
        }) as any[];

        const activities = activitiesQuery.map((a: any) => ({ id: a.id, title: a.title }));
        const filterActivityNames = activitiesQuery.map((a: any) => a.title);
        const assignees = [...new Set(tasks.map(t => t.assignee_name))].filter(Boolean);

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
            { message: error.message || 'Error fetching unit tasks', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const { unitId, userId } = await getUnitIdFromToken();
        const body = await req.json();

        const { title, parent_id, assigned_to, end_date, priority, description } = body;

        if (!title || !parent_id || !end_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Verify the parent activity actually belongs to this unit (security check)
        const parentCheck = await query({
            query: 'SELECT id FROM strategic_activities WHERE id = ? AND unit_id = ?',
            values: [parent_id, unitId]
        }) as any[];

        if (parentCheck.length === 0) {
            return NextResponse.json({ message: 'Invalid parent activity for your unit' }, { status: 403 });
        }

        const result = await query({
            query: `
                INSERT INTO strategic_activities 
                (title, parent_id, unit_id, assigned_to, end_date, priority, description, status, progress, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Not Started', 0, ?)
            `,
            values: [
                title,
                parent_id,
                unitId,
                assigned_to || null,
                end_date,
                priority || 'Medium',
                description || '',
                userId
            ]
        }) as any;

        return NextResponse.json({ message: 'Task created successfully', id: result.insertId });

    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Error creating task', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function PUT(req: Request) {
    try {
        const { unitId } = await getUnitIdFromToken();
        const body = await req.json();

        const { id, title, assigned_to, end_date, priority, description, status, progress, reviewer_notes, score } = body;

        if (!id) {
            return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
        }

        // Verify task ownership
        const taskCheck = await query({
            query: `
                SELECT sa.id 
                FROM strategic_activities sa
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                WHERE sa.id = ? AND (sa.unit_id = ? OR p.unit_id = ?)
            `,
            values: [id, unitId, unitId]
        }) as any[];

        if (taskCheck.length === 0) {
            return NextResponse.json({ message: 'Task not found or unauthorized' }, { status: 403 });
        }

        // Build dynamic update query
        let updateQuery = 'UPDATE strategic_activities SET updated_at = CURRENT_TIMESTAMP';
        const values = [];

        if (title !== undefined) { updateQuery += ', title = ?'; values.push(title); }
        if (assigned_to !== undefined) { updateQuery += ', assigned_to = ?'; values.push(assigned_to); }
        if (end_date !== undefined) { updateQuery += ', end_date = ?'; values.push(end_date); }
        if (priority !== undefined) { updateQuery += ', priority = ?'; values.push(priority); }
        if (description !== undefined) { updateQuery += ', description = ?'; values.push(description); }
        if (status !== undefined) { updateQuery += ', status = ?'; values.push(status); }
        if (progress !== undefined) { updateQuery += ', progress = ?'; values.push(progress); }
        if (reviewer_notes !== undefined) { updateQuery += ', reviewer_notes = ?'; values.push(reviewer_notes); }
        if (score !== undefined) { updateQuery += ', score = ?'; values.push(score); }

        updateQuery += ' WHERE id = ?';
        values.push(id);

        await query({ query: updateQuery, values });

        return NextResponse.json({ message: 'Task updated successfully' });

    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Error updating task', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
