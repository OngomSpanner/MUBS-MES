import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { isCommitteeType } from '@/lib/committee-types';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        const userId = Number(id);
        if (!userId) {
            return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
        }
        const rows = (await query({
            query: 'SELECT committee_type FROM user_committee_assignments WHERE user_id = ? ORDER BY committee_type',
            values: [userId]
        })) as any[];
        const committees = (rows || []).map((r: any) => r.committee_type).filter(Boolean);
        return NextResponse.json(committees);
    } catch (e: any) {
        if (e?.message?.includes('Invalid token') || e?.message?.includes('Unauthorized')) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        console.error('GET user committees error:', e);
        return NextResponse.json({ message: 'Error fetching committees' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        const userId = Number(id);
        if (!userId) {
            return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
        }
        const body = await request.json();
        const raw = body.committees ?? body.committee_types ?? body;
        const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
        const committees = list
            .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
            .filter((c: string) => c && isCommitteeType(c));

        await query({
            query: 'DELETE FROM user_committee_assignments WHERE user_id = ?',
            values: [userId]
        });
        for (const ct of committees) {
            await query({
                query: 'INSERT INTO user_committee_assignments (user_id, committee_type) VALUES (?, ?)',
                values: [userId, ct]
            });
        }
        return NextResponse.json({ message: 'Committees updated', committees });
    } catch (e: any) {
        if (e?.message?.includes('Invalid token') || e?.message?.includes('Unauthorized')) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        if (e?.code === 'ER_NO_SUCH_TABLE' || e?.message?.includes('user_committee_assignments')) {
            return NextResponse.json(
                { message: 'Run migration add_user_committee_assignments.sql first' },
                { status: 500 }
            );
        }
        console.error('PUT user committees error:', e);
        return NextResponse.json({ message: 'Error updating committees' }, { status: 500 });
    }
}
