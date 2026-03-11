import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

function isPrincipal(decoded: any): boolean {
    const role = decoded?.role;
    if (!role) return false;
    return role === 'principal' || String(role).toLowerCase().includes('principal');
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId || !isPrincipal(decoded)) {
            return NextResponse.json({ message: 'Forbidden: Principal access required' }, { status: 403 });
        }

        const list = await query({
            query: `
                SELECT 
                    cp.id,
                    cp.committee_type,
                    cp.title,
                    cp.minute_reference,
                    cp.description,
                    cp.submitted_by,
                    cp.department_id,
                    cp.budget,
                    cp.status,
                    cp.submitted_date,
                    cp.created_at,
                    d.name as department_name,
                    u.full_name as submitted_by_name
                FROM committee_proposals cp
                LEFT JOIN departments d ON d.id = cp.department_id
                LEFT JOIN users u ON u.id = cp.submitted_by
                WHERE cp.status IN ('Pending', 'Edit Requested')
                ORDER BY COALESCE(cp.submitted_date, cp.created_at) DESC, cp.id DESC
            `
        }) as any[];

        const proposals = (list || []).map((row: any) => ({
            id: row.id,
            committee_type: row.committee_type,
            title: row.title,
            minute_reference: row.minute_reference,
            description: row.description,
            submitted_by: row.submitted_by,
            submitted_by_name: row.submitted_by_name,
            department_id: row.department_id,
            department_name: row.department_name,
            budget: row.budget != null ? Number(row.budget) : null,
            status: row.status,
            submitted_date: row.submitted_date,
            created_at: row.created_at,
            date: row.submitted_date
                ? new Date(row.submitted_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : row.created_at
                    ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : null
        }));

        return NextResponse.json(proposals);
    } catch (error: any) {
        console.error('Principal Committee Proposals GET Error:', error);
        return NextResponse.json(
            { message: 'Error fetching committee proposals', detail: error.message },
            { status: 500 }
        );
    }
}
