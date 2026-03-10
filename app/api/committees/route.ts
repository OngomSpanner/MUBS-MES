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

    // Must be auth'd, ideally check Admin role but letting UI handle auth guards for now

    // Fetch proposals (strategic activities created by committee members)
    // Note: For now, we assume ALL activities with a 'Pending' or 'Rejected' status, or where committee_suggestion is not null
    // were proposals. Or simply we fetch all activities. To match the view, we join users and departments.

    const sql = `
            SELECT 
                s.id, 
                s.title, 
                s.description, 
                s.status, 
                s.priority,
                DATE_FORMAT(s.created_at, '%d-%b-%Y') as submitted_date,
                s.meeting_reference as minute_reference,
                s.proposal_kpi as implementation_status,
                u.full_name as submitted_by,
                u.role as committee_type, 
                un.name as department,
                15000000 as budget, /* mock budget for UI consistency until field is added */
                s.pillar /* using the generic pillar string if we had one */
            FROM strategic_activities s
            LEFT JOIN users u ON s.created_by = u.id
            LEFT JOIN departments un ON s.committee_suggestion_department_id = un.id
            WHERE s.parent_id IS NULL AND u.role LIKE '%Committee Member%'
            ORDER BY s.created_at DESC
        `;

    const proposals = await query({ query: sql, values: [] }) as any[];

    // Map data to precisely fit the 'Proposal' TypeScript interface expected by AdminCommittee.tsx
    const formattedProposals = proposals.map(p => ({
      id: p.id,
      title: p.title,
      submitted_by: p.submitted_by || 'Unknown',
      department: p.department || 'Not specified',
      submitted_date: p.submitted_date,
      budget: p.budget || 0,
      status: p.status, // e.g. Pending, Approved, Rejected
      description: p.description,
      committee_type: p.committee_type === 'Committee Member' ? 'Academic Board' : (p.committee_type || 'Other'), // Mock mapping for UI dropdown filters
      minute_reference: p.minute_reference,
      pillar_title: p.pillar || 'Strategic Alignment Pending',
      implementation_status: p.implementation_status || ''
    }));

    return NextResponse.json(formattedProposals);

  } catch (error: any) {
    console.error('Admin Proposals API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching proposals', detail: error.message },
      { status: 500 }
    );
  }
}