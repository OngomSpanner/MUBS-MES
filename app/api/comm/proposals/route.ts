import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const committeeTypes = ['Council', 'TMC', 'Academic Board', 'Other'] as const;

export async function GET(req: Request) {
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
        const userId = decoded.userId;
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status');
        const myOnly = searchParams.get('my') === '1' || searchParams.get('my') === 'true';

        let whereClause = '1=1';
        const values: (string | number)[] = [];
        if (statusFilter) {
            if (statusFilter === 'Pending') {
                whereClause += " AND cp.status IN ('Pending', 'Edit Requested')";
            } else {
                whereClause += ' AND cp.status = ?';
                values.push(statusFilter);
            }
        }
        if (myOnly) {
            whereClause += ' AND cp.submitted_by = ?';
            values.push(userId);
        }

        let list: any[];
        try {
            list = await query({
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
                        cp.pillar_id,
                        cp.status,
                        cp.implementation_status,
                        cp.submitted_date,
                        cp.reviewed_date,
                        cp.reviewer_notes,
                        cp.created_at,
                        d.name as department_name,
                        u.full_name as submitted_by_name,
                        u.position as submitted_by_position,
                        cp.committee_position
                    FROM committee_proposals cp
                    LEFT JOIN departments d ON d.id = cp.department_id
                    LEFT JOIN users u ON u.id = cp.submitted_by
                    WHERE ${whereClause}
                    ORDER BY COALESCE(cp.submitted_date, cp.created_at) DESC, cp.id DESC
                `,
                values
            }) as any[];
        } catch (getErr: any) {
            const msg = String(getErr?.message || '');
            if (msg.includes('committee_position') || msg.includes('submitted_by_name') || getErr?.code === 'ER_BAD_FIELD_ERROR') {
                list = await query({
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
                            cp.pillar_id,
                            cp.status,
                            cp.implementation_status,
                            cp.submitted_date,
                            cp.reviewed_date,
                            cp.reviewer_notes,
                            cp.created_at,
                            d.name as department_name,
                            u.full_name as submitted_by_name,
                            u.position as submitted_by_position
                        FROM committee_proposals cp
                        LEFT JOIN departments d ON d.id = cp.department_id
                        LEFT JOIN users u ON u.id = cp.submitted_by
                        WHERE ${whereClause}
                        ORDER BY COALESCE(cp.submitted_date, cp.created_at) DESC, cp.id DESC
                    `,
                    values
                }) as any[];
            } else {
                throw getErr;
            }
        }

        const proposals = (list || []).map((row: any) => ({
            id: row.id,
            committee_type: row.committee_type,
            title: row.title,
            minute_reference: row.minute_reference,
            description: row.description,
            submitted_by: row.submitted_by,
            submitted_by_name: row.submitted_by_name,
            submitted_by_position: row.submitted_by_position ?? null,
            committee_position: row.committee_position ?? null,
            department_id: row.department_id,
            department_name: row.department_name,
            budget: row.budget != null ? Number(row.budget) : null,
            pillar_id: row.pillar_id,
            status: row.status,
            implementation_status: row.implementation_status,
            submitted_date: row.submitted_date,
            reviewed_date: row.reviewed_date,
            reviewer_notes: row.reviewer_notes,
            created_at: row.created_at,
            date: row.submitted_date
                ? new Date(row.submitted_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : row.created_at
                    ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : null,
            meta: row.description || row.minute_reference || ''
        }));

        return NextResponse.json(proposals);
    } catch (error: any) {
        console.error('Committee Proposals GET Error:', error);
        return NextResponse.json(
            { message: 'Error fetching proposals', detail: error.message },
            { status: 500 }
        );
    }
}

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
        const submittedBy = decoded.userId;

        const body = await req.json();
        const {
            title,
            description,
            minute_reference,
            meeting_reference,
            committee_type,
            committee_position,
            department_id,
            suggested_unit_id,
            budget,
            pillar_id
        } = body;

        if (!title || !description) {
            return NextResponse.json(
                { message: 'Missing required fields: title and description' },
                { status: 400 }
            );
        }

        const minuteRef = minute_reference || meeting_reference || null;
        const deptId = department_id ?? suggested_unit_id ?? null;
        const type = committee_type && committeeTypes.includes(committee_type) ? committee_type : 'Other';

        const submitterRows = await query({
            query: 'SELECT full_name FROM users WHERE id = ?',
            values: [submittedBy]
        }) as any[];
        const submitter = submitterRows?.[0];
        const submittedByName = submitter?.full_name ?? null;
        const committeePos = (committee_position && String(committee_position).trim()) ? String(committee_position).trim().slice(0, 200) : null;

        let result: any;
        try {
            result = await query({
                query: `
                    INSERT INTO committee_proposals 
                    (committee_type, title, minute_reference, description, submitted_by, submitted_by_name, committee_position, department_id, budget, pillar_id, status, implementation_status, submitted_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', CURDATE(), NOW())
                `,
                values: [type, title, minuteRef, description, submittedBy, submittedByName, committeePos, deptId, budget ?? null, pillar_id ?? null]
            }) as any;
        } catch (insertErr: any) {
            const msg = String(insertErr?.message || insertErr?.code || '');
            if (msg.includes('submitted_by_name') || msg.includes('committee_position') || msg.includes('submitted_by_position') || insertErr?.code === 'ER_BAD_FIELD_ERROR') {
                result = await query({
                    query: `
                        INSERT INTO committee_proposals 
                        (committee_type, title, minute_reference, description, submitted_by, department_id, budget, pillar_id, status, implementation_status, submitted_date, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', CURDATE(), NOW())
                    `,
                    values: [type, title, minuteRef, description, submittedBy, deptId, budget ?? null, pillar_id ?? null]
                }) as any;
            } else {
                throw insertErr;
            }
        }

        return NextResponse.json({ message: 'Proposal submitted successfully', id: result.insertId });
    } catch (error: any) {
        console.error('Committee Proposal POST Error:', error?.message ?? error);
        return NextResponse.json(
            { message: 'Error saving proposal', detail: error?.message },
            { status: 500 }
        );
    }
}
