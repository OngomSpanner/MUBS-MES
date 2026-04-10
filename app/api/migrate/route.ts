import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        console.log('Running migration: Making activity_assignment_id nullable');
        await query({
            query: 'ALTER TABLE staff_reports MODIFY COLUMN activity_assignment_id INT NULL'
        });
        return NextResponse.json({ message: 'Migration successful' });
    } catch (error: any) {
        console.error('Migration failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
