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
        if (!decoded?.userId) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // 1. Proposal Stats (COALESCE so empty table returns 0; include Edit Requested in pending)
        const proposalStats = await query({
            query: `
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
                    COALESCE(SUM(CASE WHEN status IN ('Pending', 'Edit Requested') THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected
                FROM committee_proposals
            `
        }) as any[];

        const row = proposalStats[0];
        const stats = {
            total: Number(row?.total ?? 0),
            approved: Number(row?.approved ?? 0),
            pending: Number(row?.pending ?? 0),
            rejected: Number(row?.rejected ?? 0)
        };

        // 2. Recent Proposals with id, department_name, committee_type for links and display
        const recentProposals = await query({
            query: `
                SELECT 
                    cp.id,
                    cp.title,
                    cp.status,
                    cp.committee_type,
                    DATE_FORMAT(COALESCE(cp.submitted_date, cp.created_at), '%d %b %Y') as date,
                    cp.description as meta,
                    d.name as department_name
                FROM committee_proposals cp
                LEFT JOIN departments d ON d.id = cp.department_id
                ORDER BY COALESCE(cp.submitted_date, cp.created_at) DESC, cp.id DESC
                LIMIT 5
            `
        }) as any[];

        const proposals = (recentProposals || []).map((r: any) => ({
            id: Number(r.id),
            title: r.title,
            status: r.status ?? 'Pending',
            committee_type: r.committee_type ?? null,
            date: r.date ?? null,
            meta: (r.meta || r.minute_reference || '').toString().slice(0, 80) + ((r.meta && r.meta.length > 80) ? '…' : ''),
            department_name: r.department_name ?? null
        }));

        // 3. Recent Activity from committee_proposals (last 6 for timeline)
        const activityRows = await query({
            query: `
                SELECT 
                    cp.title,
                    cp.status,
                    COALESCE(cp.reviewed_date, cp.submitted_date, cp.created_at) as ts,
                    d.name as department_name
                FROM committee_proposals cp
                LEFT JOIN departments d ON d.id = cp.department_id
                ORDER BY COALESCE(cp.reviewed_date, cp.submitted_date, cp.created_at) DESC, cp.id DESC
                LIMIT 6
            `
        }) as any[];

        const now = new Date();
        const activity = (activityRows || []).map((a: any) => {
            const d = a.ts ? new Date(a.ts) : null;
            const isToday = d && d.toDateString() === now.toDateString();
            const timestamp = !d ? '' : isToday ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            let icon = 'post_add';
            let bgColor = '#f5f3ff';
            let iconColor = '#7c3aed';
            if (a.status === 'Approved') {
                icon = 'check_circle';
                bgColor = '#dcfce7';
                iconColor = '#059669';
            } else if (a.status === 'Rejected') {
                icon = 'cancel';
                bgColor = '#fee2e2';
                iconColor = '#e31837';
            } else if (a.status === 'Pending' || a.status === 'Edit Requested') {
                icon = 'hourglass_top';
                bgColor = '#fef9c3';
                iconColor = '#b45309';
            }
            const dept = a.department_name ? ` · ${a.department_name}` : '';
            return {
                description: a.title,
                timestamp,
                detail: (a.status === 'Approved' ? 'Assigned to ' : a.status === 'Rejected' ? 'Feedback provided · ' : 'Under review · ') + (timestamp || '') + dept,
                icon,
                bgColor,
                iconColor
            };
        });

        return NextResponse.json({
            stats,
            proposals,
            activity
        });
    } catch (error: any) {
        console.error('Committee Dashboard API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching committee dashboard data', detail: error.message },
            { status: 500 }
        );
    }
}
