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

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    let rows: any[];
    const sqlWithPosition = `
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
        cp.committee_position,
        u.full_name AS submitted_by_name,
        d.name AS department_name
      FROM committee_proposals cp
      LEFT JOIN users u ON cp.submitted_by = u.id
      LEFT JOIN departments d ON cp.department_id = d.id
      ORDER BY cp.created_at DESC
    `;
    const sqlWithoutPosition = `
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
        u.full_name AS submitted_by_name,
        d.name AS department_name
      FROM committee_proposals cp
      LEFT JOIN users u ON cp.submitted_by = u.id
      LEFT JOIN departments d ON cp.department_id = d.id
      ORDER BY cp.created_at DESC
    `;

    try {
      rows = (await query({ query: sqlWithPosition, values: [] })) as any[];
    } catch (qErr: any) {
      const msg = String(qErr?.message || '');
      if (msg.includes('committee_position') || (qErr as any)?.code === 'ER_BAD_FIELD_ERROR') {
        rows = (await query({ query: sqlWithoutPosition, values: [] })) as any[];
      } else {
        throw qErr;
      }
    }

    const proposals = rows.map((p) => ({
      id: p.id,
      title: p.title,
      committee_type: p.committee_type || 'Other',
      minute_reference: p.minute_reference,
      description: p.description,
      submitted_by: p.submitted_by_name?.trim() || (p.submitted_by != null ? `User #${p.submitted_by}` : 'Unknown'),
      submitted_by_id: p.submitted_by,
      committee_position: p.committee_position ?? null,
      department: p.department_name || 'Not specified',
      department_id: p.department_id,
      budget: p.budget != null ? Number(p.budget) : 0,
      pillar_id: p.pillar_id,
      status: p.status || 'Pending',
      implementation_status: p.implementation_status || 'Pending',
      submitted_date: p.submitted_date ? (typeof p.submitted_date === 'string' ? p.submitted_date.split('T')[0] : p.submitted_date) : null,
      reviewed_date: p.reviewed_date ? (typeof p.reviewed_date === 'string' ? p.reviewed_date.split('T')[0] : p.reviewed_date) : null,
      reviewer_notes: p.reviewer_notes,
      created_at: p.created_at
    }));

    return NextResponse.json(proposals);
  } catch (error: any) {
    console.error('Admin Proposals API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching proposals', detail: error.message },
      { status: 500 }
    );
  }
}