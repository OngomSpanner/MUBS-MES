import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// GET — all standard processes assigned to the currently logged-in staff member
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const baseSelect = `
        SELECT 
          spa.id,
          spa.activity_id,
          spa.standard_process_id,
          spa.status,
          spa.actual_value,
          spa.commentary,
          spa.start_date,
          spa.end_date,
          spa.created_at,
          sp.step_name AS task_name,
          sp.step_order AS task_order,
          __PI_COL__
          st.id AS standard_id,
          st.title AS standard_title,
          st.quality_standard,
          st.output_standard,
          sa.title AS activity_title,
          sa.pillar,
          sa.target_kpi,
          sa.unit_of_measure,
          sa.description AS activity_description
        FROM staff_process_assignments spa
        JOIN standard_processes sp ON spa.standard_process_id = sp.id
        JOIN standards st ON sp.standard_id = st.id
        JOIN strategic_activities sa ON spa.activity_id = sa.id
        WHERE spa.staff_id = ? AND spa.start_date IS NOT NULL
        ORDER BY FIELD(spa.status, 'pending', 'in_progress', 'completed'), sp.step_order ASC
      `;
    let rows: any[];
    try {
      rows = (await query({
        query: baseSelect.replace('__PI_COL__', 'st.performance_indicator,\n          '),
        values: [decoded.userId],
      })) as any[];
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        rows = (await query({
          query: baseSelect.replace('__PI_COL__', ''),
          values: [decoded.userId],
        })) as any[];
        rows = rows.map((r) => ({ ...r, performance_indicator: null }));
      } else {
        throw e;
      }
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching staff process assignments:', error);
    return NextResponse.json({ message: 'Error fetching assignments' }, { status: 500 });
  }
}
