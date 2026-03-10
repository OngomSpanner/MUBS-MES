import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const activities = await query({ query: 'SELECT id, title, department_id, parent_id FROM strategic_activities LIMIT 20' });
        return NextResponse.json({ activities });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
