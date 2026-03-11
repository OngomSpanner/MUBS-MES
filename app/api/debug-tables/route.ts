import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        const tables = await query({ query: 'SHOW TABLES' });
        return NextResponse.json({ tables });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
