import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        // 1. Create sub-activities for activity ID 1 (Faculty of Computing)
        const subTasks = [
            { title: 'Server Room Cabling', priority: 'High', status: 'In Progress', progress: 45 },
            { title: 'Network Switch Configuration', priority: 'Medium', status: 'Not Started', progress: 0 },
            { title: 'UPS Installation', priority: 'Low', status: 'Completed', progress: 100 },
            { title: 'Fiber Link Termination', priority: 'High', status: 'Delayed', progress: 10 }
        ];

        const assignees = [17, 18, 19];

        for (let i = 0; i < subTasks.length; i++) {
            const task = subTasks[i];
            const assigneeId = assignees[i % assignees.length];

            await query({
                query: `
                    INSERT INTO strategic_activities 
                    (title, pillar, department_id, status, priority, parent_id, progress, assigned_to, description, start_date, end_date) 
                    VALUES (?, 'Human Capital & Sustainability', 1, ?, ?, 1, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY))
                `,
                values: [
                    task.title,
                    task.status,
                    task.priority,
                    task.progress,
                    assigneeId,
                    `Detailed task for ${task.title}`
                ]
            });
        }

        return NextResponse.json({ message: 'Sub-tasks seeded and assigned successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
