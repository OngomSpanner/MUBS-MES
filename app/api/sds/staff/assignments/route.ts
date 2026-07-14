import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';

export const dynamic = 'force-dynamic';

/** Staff read-only SDS assigned activities. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureSdsSchema();

    const rows = (await query({
      query: `
        SELECT a.id AS assignment_id, a.target_date, a.notes, a.assigned_at,
               act.id AS activity_id, act.activity_name, act.duration_text, act.sequence_no AS activity_sequence,
               o.id AS output_id, o.output_code, o.service_description, o.process_text,
               s.id AS standard_id, s.code AS standard_code, s.title AS standard_title, s.pathway,
               assigner.full_name AS assigned_by_name
        FROM sds_activity_assignments a
        JOIN sds_activities act ON act.id = a.activity_id
        JOIN sds_outputs o ON o.id = act.output_id
        JOIN sds_standards s ON s.id = o.standard_id
        LEFT JOIN users assigner ON assigner.id = a.assigned_by
        WHERE a.staff_user_id = ? AND a.status = 'active'
        ORDER BY a.target_date IS NULL, a.target_date ASC, s.code ASC, act.sequence_no ASC
      `,
      values: [decoded.userId],
    })) as Record<string, unknown>[];

    // Enrich with co-assignees + full process chain activities
    const enriched = [];
    for (const row of rows) {
      const activityId = Number(row.activity_id);
      const outputId = Number(row.output_id);

      const chain = (await query({
        query: `
          SELECT id, sequence_no, activity_name, duration_text
          FROM sds_activities
          WHERE output_id = ?
          ORDER BY sequence_no ASC, id ASC
        `,
        values: [outputId],
      })) as Record<string, unknown>[];

      const coAssignees = (await query({
        query: `
          SELECT u.id, u.full_name
          FROM sds_activity_assignments a2
          JOIN users u ON u.id = a2.staff_user_id
          WHERE a2.activity_id = ? AND a2.status = 'active' AND a2.staff_user_id <> ?
          ORDER BY u.full_name ASC
        `,
        values: [activityId, decoded.userId],
      })) as { id: number; full_name: string }[];

      enriched.push({
        ...row,
        process_chain: chain,
        co_assignees: coAssignees,
      });
    }

    return NextResponse.json({ assignments: enriched });
  } catch (e) {
    console.error('sds staff GET', e);
    return NextResponse.json({ message: 'Error loading SDS assignments' }, { status: 500 });
  }
}
