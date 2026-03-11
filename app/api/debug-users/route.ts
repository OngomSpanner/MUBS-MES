import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        const users = await query({ query: 'SELECT id, full_name, role, department FROM users' });
        return NextResponse.json({ users });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
