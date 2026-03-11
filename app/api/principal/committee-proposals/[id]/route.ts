import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

function isPrincipal(decoded: any): boolean {
    const role = decoded?.role;
    if (!role) return false;
    return role === 'principal' || String(role).toLowerCase().includes('principal');
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const proposalId = parseInt(id, 10);
        if (isNaN(proposalId)) {
            return NextResponse.json({ message: 'Invalid proposal id' }, { status: 400 });
        }

        const body = await req.json();
        const { action, reviewer_notes } = body;
        if (action !== 'Approved' && action !== 'Rejected') {
            return NextResponse.json(
                { message: 'action must be Approved or Rejected' },
                { status: 400 }
            );
        }

        await query({
            query: `
                UPDATE committee_proposals
                SET status = ?, reviewed_date = CURDATE(), reviewer_notes = ?
                WHERE id = ? AND status IN ('Pending', 'Edit Requested')
            `,
            values: [action, reviewer_notes ?? null, proposalId]
        });

        // On Approve: create a top-level strategic activity from the proposal (per DB reference)
        if (action === 'Approved') {
            const rows = await query({
                query: `SELECT id, committee_type, title, description, department_id, minute_reference FROM committee_proposals WHERE id = ?`,
                values: [proposalId]
            }) as any[];
            const cp = rows?.[0];
            if (cp) {
                const sourceMap: Record<string, string> = {
                    'Council': 'council_minutes',
                    'TMC': 'tmc_minutes',
                    'Academic Board': 'academic_board',
                    'Other': 'other_duty'
                };
                const source = sourceMap[cp.committee_type] ?? 'other_duty';
                await query({
                    query: `
                        INSERT INTO strategic_activities
                        (activity_type, source, parent_id, title, description, pillar, department_id, meeting_reference, committee_suggestion_unit_id, status, progress, created_by)
                        VALUES ('main', ?, NULL, ?, ?, NULL, ?, ?, ?, 'pending', 0, ?)
                    `,
                    values: [
                        source,
                        cp.title ?? '',
                        cp.description ?? null,
                        cp.department_id ?? null,
                        cp.minute_reference ?? null,
                        proposalId,
                        decoded.userId
                    ]
                });
            }
        }

        return NextResponse.json({ message: `Proposal ${action.toLowerCase()} successfully` });
    } catch (error: any) {
        console.error('Principal Committee Proposal PATCH Error:', error);
        return NextResponse.json(
            { message: 'Error updating proposal', detail: error.message },
            { status: 500 }
        );
    }
}
