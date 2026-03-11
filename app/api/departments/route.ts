import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // Fetch all active departments with parent_id and unit_type for filtering (faculty/office vs department/unit)
        const departments = await query({
            query: 'SELECT id, name, parent_id, unit_type FROM departments WHERE is_active = 1 ORDER BY parent_id IS NULL DESC, name ASC',
            values: []
        }) as any[];

        return NextResponse.json(departments);

    } catch (error: any) {
        console.error('Departments API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching departments', detail: error.message },
            { status: 500 }
        );
    }
}
