import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';

export const dynamic = 'force-dynamic';

/**
 * HRM appraisal pull endpoint (pull model).
 * Auth: Authorization: Bearer <SDS_HRM_PULL_SECRET or CRON_SECRET>
 * Lookup by staffNumber / email / userId.
 *
 * Returns entries shaped for appraisal Section B:
 * - performance_output
 * - performance_indicator
 * - performance_targets
 */
function authorize(request: Request): boolean {
  const secret = process.env.SDS_HRM_PULL_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const altKey = request.headers.get('x-api-key') || '';
  return token === secret || altKey === secret;
}

export async function GET(request: Request) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    await ensureSdsSchema();

    const url = new URL(request.url);
    const staffNumber = String(url.searchParams.get('staffNumber') || url.searchParams.get('employeeId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim();
    const userIdParam = Number(url.searchParams.get('userId') || 0);
    const hrmsStaffId = Number(url.searchParams.get('hrmsStaffId') || 0);

    let userId = userIdParam;
    if (!userId) {
      if (hrmsStaffId > 0) {
        const rows = (await query({
          query: 'SELECT id FROM users WHERE hrms_staff_id = ? LIMIT 1',
          values: [hrmsStaffId],
        })) as { id: number }[];
        userId = Number(rows[0]?.id || 0);
      } else if (staffNumber) {
        const rows = (await query({
          query: 'SELECT id FROM users WHERE employee_id = ? OR CAST(hrms_staff_id AS CHAR) = ? LIMIT 1',
          values: [staffNumber, staffNumber],
        })) as { id: number }[];
        userId = Number(rows[0]?.id || 0);
      } else if (email) {
        const rows = (await query({
          query: 'SELECT id FROM users WHERE email = ? LIMIT 1',
          values: [email],
        })) as { id: number }[];
        userId = Number(rows[0]?.id || 0);
      }
    }

    if (!userId) {
      return NextResponse.json({ message: 'User not found', entries: [] }, { status: 404 });
    }

    const rows = (await query({
      query: `
        SELECT a.id AS assignment_id, a.target_date, a.assigned_at,
               act.activity_name, act.duration_text,
               o.service_description, o.performance_indicators_json,
               s.code AS standard_code, s.title AS standard_title
        FROM sds_activity_assignments a
        JOIN sds_activities act ON act.id = a.activity_id
        JOIN sds_outputs o ON o.id = act.output_id
        JOIN sds_standards s ON s.id = o.standard_id
        WHERE a.staff_user_id = ? AND a.status = 'active'
        ORDER BY a.target_date IS NULL, a.target_date ASC, a.id ASC
      `,
      values: [userId],
    })) as Record<string, unknown>[];

    const entries = rows.map((r) => {
      let pis: string[] = [];
      try {
        const raw = r.performance_indicators_json;
        if (Array.isArray(raw)) pis = raw.map(String);
        else if (typeof raw === 'string' && raw.trim()) pis = JSON.parse(raw);
      } catch {
        pis = [];
      }
      const firstPi = pis.find((p) => String(p).trim()) || null;
      const activityName = String(r.activity_name || '').trim();
      const outputDesc = String(r.service_description || '').trim();
      const code = String(r.standard_code || '').trim();

      return {
        assignment_id: Number(r.assignment_id),
        standard_code: code,
        standard_title: r.standard_title,
        performance_output: outputDesc
          ? `${outputDesc} — ${activityName}`
          : activityName,
        performance_indicator:
          firstPi ||
          (code
            ? `Completion of assigned SDS activity within approved timeline (${code})`
            : 'Completion of assigned SDS activity within approved timeline'),
        performance_targets: r.target_date
          ? String(r.target_date).slice(0, 10)
          : String(r.duration_text || '').trim() || null,
        activity_name: activityName,
        duration_text: r.duration_text,
        target_date: r.target_date,
        assigned_at: r.assigned_at,
      };
    });

    return NextResponse.json({
      user_id: userId,
      staff_number: staffNumber || null,
      email: email || null,
      entries,
    });
  } catch (e) {
    console.error('sds hrm appraisal GET', e);
    return NextResponse.json({ message: 'Error loading appraisal SDS entries' }, { status: 500 });
  }
}
