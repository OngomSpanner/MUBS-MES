import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const departments = await query({ query: 'SELECT * FROM departments' });
        return NextResponse.json({ departments });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
