import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disallowInProduction } from '@/lib/api-guard';

export async function GET() {
    const notAllowed = disallowInProduction();
    if (notAllowed) return notAllowed;
    try {
        await query({
            query: "UPDATE users SET department = 'Faculty of Computing and Informatics' WHERE department = 'Faculty of Computing'"
        });
        return NextResponse.json({ message: 'User departments updated for department 1' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
