import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const body = await req.json();

        const {
            title,
            pillar,
            priority,
            description,
            kpi,
            suggested_unit_id,
            meeting_reference,
            deadline,
            evidence_url
        } = body;

        if (!title || !description || !meeting_reference) {
            return NextResponse.json({ message: 'Missing required strategic activity fields' }, { status: 400 });
        }

        const result = await query({
            query: `
                INSERT INTO strategic_activities 
                (
                    title, description, priority, end_date, 
                    status, progress, created_by, 
                    proposal_kpi, evidence_url, meeting_reference, committee_suggestion_department_id
                ) 
                VALUES (?, ?, ?, ?, 'Pending', 0, ?, ?, ?, ?, ?)
            `,
            values: [
                title,
                description,
                priority || 'Medium',
                deadline || null,
                decoded.userId,
                kpi || null,
                evidence_url || null,
                meeting_reference,
                suggested_unit_id || null
            ]
        }) as any;

        return NextResponse.json({ message: 'Proposal submitted successfully', id: result.insertId });

    } catch (error: any) {
        console.error('Committee Proposal API Error:', error);
        return NextResponse.json(
            { message: 'Error saving proposal', detail: error.message },
            { status: 500 }
        );
    }
}
