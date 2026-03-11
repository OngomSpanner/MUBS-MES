import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        const activities = await query({ query: 'SELECT id, title, department_id, parent_id FROM strategic_activities LIMIT 20' });
        return NextResponse.json({ activities });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
