import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { sqlTopStrategicMain } from '@/lib/strategic-activity-sql';

export const dynamic = 'force-dynamic';

type Period = 'week' | 'month' | 'quarter';

/** Same strategic-activity scope as `/api/dashboard/department-head` and `/api/department-head/activities`. */
function activityVisibilitySql(): string {
  return `(
                  (${sqlTopStrategicMain('sa')})
                  OR (sa.parent_id IS NOT NULL AND COALESCE(sa.source, '') = 'strategic_plan')
                )`;
}

function getPeriodBounds(period: Period): { start: Date; buckets: { key: string; label: string }[] } {
    const now = new Date();
    const buckets: { key: string; label: string }[] = [];
    const start = new Date(now);

    if (period === 'week') {
        start.setDate(now.getDate() - 11 * 7); // Go back 11 weeks + this week = 12 buckets
        for (let i = 0; i < 12; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i * 7);
            const sun = new Date(d);
            sun.setDate(d.getDate() - d.getDay());
            buckets.push({ key: sun.toISOString().slice(0, 10), label: `Wk ${sun.getDate()}/${sun.getMonth() + 1}` });
        }
    } else if (period === 'month') {
        start.setMonth(now.getMonth() - 11);
        for (let i = 0; i < 12; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
            buckets.push({ key: d.toISOString().slice(0, 7), label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
        }
    } else {
        // Start 3 quarters ago to include current quarter in the 4 buckets
        start.setMonth(now.getMonth() - 9 - (now.getMonth() % 3));
        for (let i = 0; i < 4; i++) {
            const m = start.getMonth() + i * 3;
            const d = new Date(start.getFullYear(), m, 1);
            // Fix: handle years/months correctly for labels
            const displayMonth = d.getMonth();
            const displayYear = d.getFullYear();
            const q = Math.floor(displayMonth / 3) + 1;
            buckets.push({ key: `${displayYear}-Q${q}`, label: `Q${q} ${displayYear}` });
        }
    }
    return { start, buckets };
}

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const decoded = verifyToken(token) as any;
        if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({
                performancePercent: null,
                totalPoints: 0,
                maxPoints: 0,
                period: 'week',
                timeSeries: [],
                byStaff: []
            });
        }

        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'week') as Period;
        if (!['week', 'month', 'quarter'].includes(period)) {
            return NextResponse.json({ message: 'period must be week, month, or quarter' }, { status: 400 });
        }

        const placeholders = inPlaceholders(departmentIds.length);
        const vis = activityVisibilitySql();
        let rows: { db_status: string; eval_date: string; staff_id: number; staff_name: string }[] = [];
        try {
            const q = await query({
                query: `
                    SELECT db_status, eval_date, staff_id, staff_name FROM (
                        SELECT 
                            sr.status as db_status,
                            DATE(COALESCE(e.evaluation_date, sr.updated_at)) as eval_date,
                            aa.assigned_to_user_id as staff_id,
                            u.full_name as staff_name
                        FROM staff_reports sr
                        INNER JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                        INNER JOIN strategic_activities sa ON aa.activity_id = sa.id
                        LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                        LEFT JOIN users u ON u.id = aa.assigned_to_user_id
                        WHERE sa.department_id IN (${placeholders})
                          AND ${vis}
                          AND sr.status IN ('evaluated', 'incomplete', 'not_done')
                        UNION ALL
                        SELECT 
                            sr.status as db_status,
                            DATE(COALESCE(e.evaluation_date, sr.updated_at)) as eval_date,
                            spa.staff_id as staff_id,
                            u.full_name as staff_name
                        FROM staff_reports sr
                        INNER JOIN staff_process_assignments spa ON sr.process_assignment_id = spa.id
                        INNER JOIN strategic_activities sa ON spa.activity_id = sa.id
                        LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                        LEFT JOIN users u ON u.id = spa.staff_id
                        WHERE sa.department_id IN (${placeholders})
                          AND ${vis}
                          AND sr.status IN ('evaluated', 'incomplete', 'not_done')
                    ) perf_rows
                `,
                values: [...departmentIds, ...departmentIds],
            }) as any[];
            rows = q;
        } catch (e: any) {
            if (e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || e?.message?.includes('not_done')) {
                return NextResponse.json({
                    performancePercent: null,
                    totalPoints: 0,
                    maxPoints: 0,
                    period,
                    timeSeries: [],
                    byStaff: [],
                    message: 'Run plain_status_validation_gate migration for performance data.'
                });
            }
            throw e;
        }

        const { start, buckets } = getPeriodBounds(period);
        const bucketCounts: Record<string, { complete: number; incomplete: number; notDone: number }> = {};
        const staffCounts: Record<number, { name: string; complete: number; incomplete: number; notDone: number }> = {};

        buckets.forEach(b => { bucketCounts[b.key] = { complete: 0, incomplete: 0, notDone: 0 }; });

        rows.forEach((r: any) => {
            const dateStr = r.eval_date ? new Date(r.eval_date).toISOString().slice(0, 10) : null;
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (d < start) return;

            let key: string;
            if (period === 'week') {
                const sun = new Date(d);
                sun.setDate(d.getDate() - d.getDay());
                key = sun.toISOString().slice(0, 10);
            } else if (period === 'month') {
                key = d.toISOString().slice(0, 7);
            } else {
                const q = Math.floor(d.getMonth() / 3) + 1;
                key = `${d.getFullYear()}-Q${q}`;
            }
            if (!bucketCounts[key]) bucketCounts[key] = { complete: 0, incomplete: 0, notDone: 0 };

            const sid = Number(r.staff_id);
            if (!staffCounts[sid]) staffCounts[sid] = { name: r.staff_name || 'Unknown', complete: 0, incomplete: 0, notDone: 0 };

            const status = (r.db_status || '').toLowerCase();
            if (status === 'evaluated') {
                bucketCounts[key].complete++;
                staffCounts[sid].complete++;
            } else if (status === 'incomplete') {
                bucketCounts[key].incomplete++;
                staffCounts[sid].incomplete++;
            } else if (status === 'not_done') {
                bucketCounts[key].notDone++;
                staffCounts[sid].notDone++;
            }
        });

        let totalPoints = 0, totalMax = 0;
        const timeSeries = buckets.map(b => {
            const c = bucketCounts[b.key] || { complete: 0, incomplete: 0, notDone: 0 };
            const total = c.complete + c.incomplete + c.notDone;
            const points = c.complete * 2 + c.incomplete * 1;
            const max = total * 2;
            totalPoints += points;
            totalMax += max;
            return {
                periodLabel: b.label,
                periodKey: b.key,
                complete: c.complete,
                incomplete: c.incomplete,
                notDone: c.notDone,
                total,
                pointsEarned: points,
                performancePercent: max > 0 ? Math.round((points / max) * 100) : 0
            };
        });

        const performancePercent = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : null;

        const byStaff = Object.entries(staffCounts).map(([id, c]) => {
            const total = c.complete + c.incomplete + c.notDone;
            const points = c.complete * 2 + c.incomplete * 1;
            const max = total * 2;
            return {
                staffId: Number(id),
                staffName: c.name,
                complete: c.complete,
                incomplete: c.incomplete,
                notDone: c.notDone,
                total,
                performancePercent: max > 0 ? Math.round((points / max) * 100) : 0
            };
        }).sort((a, b) => b.performancePercent - a.performancePercent);

        return NextResponse.json({
            performancePercent,
            totalPoints,
            maxPoints: totalMax,
            period,
            timeSeries,
            byStaff
        });
    } catch (error: any) {
        console.error('Department Head Performance API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching performance data', detail: error.message },
            { status: 500 }
        );
    }
}
