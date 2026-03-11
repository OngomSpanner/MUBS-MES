import { NextResponse } from 'next/server';
import { query, default as pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

function committeeTypeToSource(committeeType: string): string {
  const map: Record<string, string> = {
    Council: 'council_minutes',
    TMC: 'tmc_minutes',
    'Academic Board': 'academic_board',
    Other: 'other_duty'
  };
  return map[committeeType] || 'other_duty';
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
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

        const body = await request.json();
        const status = body.status && String(body.status).trim();
        const reviewer_notes = body.reviewer_notes;

        if (!status) {
            return NextResponse.json({ message: 'Status is required' }, { status: 400 });
        }

        if (!['Approved', 'Rejected', 'Edit Requested'].includes(status)) {
            return NextResponse.json({ message: 'Invalid status type for review' }, { status: 400 });
        }

        const isApproved = status === 'Approved';

        if (isApproved) {
            // Use a transaction so UPDATE and INSERT commit together
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                const [upd] = await conn.execute(
                    `UPDATE committee_proposals SET status = ?, reviewer_notes = ?, reviewed_date = CURDATE() WHERE id = ?`,
                    [status, reviewer_notes || null, id]
                );
                const affected = (upd as any).affectedRows;
                if (affected === 0) {
                    await conn.rollback();
                    return NextResponse.json({ message: 'Proposal not found' }, { status: 404 });
                }
                const [rows] = await conn.execute(
                    `SELECT committee_type, title, description, minute_reference, department_id, submitted_by FROM committee_proposals WHERE id = ?`,
                    [id]
                );
                const p = Array.isArray(rows) ? (rows as any[])[0] : null;
                if (!p) {
                    await conn.rollback();
                    return NextResponse.json({ message: 'Proposal not found after update' }, { status: 404 });
                }
                const source = committeeTypeToSource((p.committee_type || 'Other') as string);
                const createdBy = p.submitted_by != null ? Number(p.submitted_by) : Number(decoded.userId);
                await conn.execute(
                    `INSERT INTO strategic_activities
                    (activity_type, source, parent_id, title, description, pillar, department_id, priority, status, progress, created_by, meeting_reference)
                    VALUES ('main', ?, NULL, ?, ?, NULL, ?, 'Medium', 'pending', 0, ?, ?)`,
                    [
                        source,
                        p.title || '',
                        p.description || null,
                        p.department_id != null ? Number(p.department_id) : null,
                        createdBy,
                        p.minute_reference || null
                    ]
                );
                await conn.commit();
            } catch (err: any) {
                await conn.rollback();
                console.error('Committee approve transaction error:', err);
                return NextResponse.json(
                    { message: 'Error adding activity to Strategic Activities', detail: err?.message || String(err) },
                    { status: 500 }
                );
            } finally {
                conn.release();
            }
        } else {
            // Rejected or Edit Requested: just update committee_proposals
            const updateResult = await query({
                query: `UPDATE committee_proposals SET status = ?, reviewer_notes = ?, reviewed_date = CURDATE() WHERE id = ?`,
                values: [status, reviewer_notes || null, id]
            }) as any;
            if (updateResult.affectedRows === 0) {
                return NextResponse.json({ message: 'Proposal not found' }, { status: 404 });
            }
        }

        const message = isApproved
            ? 'Proposal approved and added to Strategic Activities.'
            : `Proposal ${status.toLowerCase()} successfully`;

        return NextResponse.json({ message });

    } catch (error: any) {
        console.error('Admin Update Proposal API Error:', error);
        return NextResponse.json(
            { message: 'Error updating proposal status', detail: error.message },
            { status: 500 }
        );
    }
}
