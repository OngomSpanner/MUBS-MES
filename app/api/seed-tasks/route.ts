import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        // 1. Assign sub-activities (tasks) to users for testing
        // Users for Faculty of Computing (department_id: 1)
        // IDs: 17 (P. Kato), 18 (J. Amuge), 19 (Test Agent User)

        // Find sub-activities for department 1
        const tasks = await query({
            query: 'SELECT id FROM strategic_activities WHERE department_id = 1 AND parent_id IS NOT NULL'
        }) as any[];

        if (tasks.length > 0) {
            const assignees = [17, 18, 19];
            for (let i = 0; i < tasks.length; i++) {
                const assigneeId = assignees[i % assignees.length];
                await query({
                    query: 'UPDATE strategic_activities SET assigned_to = ? WHERE id = ?',
                    values: [assigneeId, tasks[i].id]
                });
            }
        }

        return NextResponse.json({
            message: 'Seed data applied successfully',
            tasksAssigned: tasks.length
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
