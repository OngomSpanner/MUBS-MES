import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

        // Generate list of the last 6 months
        const months: any[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1); // Set to 1 to avoid month skipping (e.g. Mar 31 -> skip Feb)
            d.setMonth(d.getMonth() - i);
            months.push({
                name: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth() + 1
            });
        }

        // Fetch all active departments
        const departments = await query({
            query: 'SELECT id, name FROM departments WHERE is_active = 1 AND parent_id IS NOT NULL ORDER BY name ASC'
        }) as any[];

        // Fetch submission status for the last 6 months
        // Logic: A department is compliant for a month if there's at least one 'submitted' report in that month.
        const submissions = await query({
            query: `
                SELECT 
                    u.department_id,
                    MONTH(sr.submitted_at) as month,
                    YEAR(sr.submitted_at) as year,
                    COUNT(sr.id) as count
                FROM staff_reports sr
                JOIN users u ON sr.submitted_by = u.id
                WHERE sr.status = 'submitted' 
                  AND sr.submitted_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY u.department_id, YEAR(sr.submitted_at), MONTH(sr.submitted_at)
            `
        }) as any[];

        // Build the grid
        const grid = departments.map(d => {
            const history = months.map(m => {
                const found = submissions.find(s => 
                    s.department_id === d.id && 
                    s.month === m.month && 
                    s.year === m.year
                );
                return {
                    month: m.name,
                    year: m.year,
                    status: found ? 'submitted' : 'missing'
                };
            });
            return {
                id: d.id,
                name: d.name,
                history
            };
        });

        return NextResponse.json({
            months: months.map(m => m.name),
            grid
        });

    } catch (error: any) {
        console.error('Admin Compliance API Error:', error);
        return NextResponse.json({ message: 'Error fetching compliance data' }, { status: 500 });
    }
}
