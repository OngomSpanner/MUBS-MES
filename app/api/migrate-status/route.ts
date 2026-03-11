import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        await query({
            query: "ALTER TABLE strategic_activities MODIFY COLUMN status ENUM('Not Started', 'In Progress', 'On Track', 'Delayed', 'Completed', 'Under Review', 'Returned') DEFAULT 'Not Started'"
        });
        return NextResponse.json({ message: 'Status enum updated successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
