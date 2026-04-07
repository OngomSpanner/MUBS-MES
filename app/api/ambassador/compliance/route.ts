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

        const userResult = await query({
            query: 'SELECT managed_unit_id FROM users WHERE id = ?',
            values: [decoded.userId]
        }) as any[];

        const managedUnitId = userResult[0]?.managed_unit_id;
        if (!managedUnitId) {
            return NextResponse.json({ message: 'Ambassador is not assigned to any Faculty/Office' }, { status: 403 });
        }

        // Generate list of the last 6 months
        const months: any[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1); // Reset day of month to 1 to avoid day-overflow skipping months like Feb
            d.setMonth(d.getMonth() - i);
            months.push({
                name: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth() + 1
            });
        }

        // Fetch all departments in the faculty
        const subUnits = await query({
            query: 'SELECT id, name FROM departments WHERE parent_id = ? AND is_active = 1 ORDER BY name ASC',
            values: [managedUnitId]
        }) as any[];

        // Fetch historical submissions for these units
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

        // Build grid 
        const grid = subUnits.map(unit => {
            const history = months.map(m => {
                const found = submissions.find(s => 
                    s.department_id === unit.id && 
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
                id: unit.id,
                name: unit.name,
                history
            };
        });

        return NextResponse.json({
            months: months.map(m => m.name),
            grid
        });

    } catch (error: any) {
        console.error('Ambassador Compliance API Error:', error);
        return NextResponse.json({ message: 'Error fetching compliance data' }, { status: 500 });
    }
}
