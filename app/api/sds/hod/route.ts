import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import { addDaysIso } from '@/lib/sds/codes';

export const dynamic = 'force-dynamic';

const HOD_ROLES = ['department head', 'unit head', 'hod'];

async function authHod() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  const role = String(decoded.role || '').trim().toLowerCase();
  if (!HOD_ROLES.includes(role)) {
    return { error: NextResponse.json({ message: 'Forbidden: HOD or Unit Head role required' }, { status: 403 }) };
  }
  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (!departmentIds.length) {
    return { error: NextResponse.json({ message: 'No department assigned' }, { status: 403 }) };
  }
  return { userId: decoded.userId, departmentIds };
}

/** HOD catalog: SDS standards owned by their department(s). */
export async function GET(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();

    const url = new URL(request.url);
    const mode = String(url.searchParams.get('mode') || 'standards');

    if (mode === 'assignments') {
      const placeholders = auth.departmentIds.map(() => '?').join(',');
      const activityId = Number(url.searchParams.get('activityId') || 0);
      const activityFilter = activityId > 0 ? ' AND a.activity_id = ?' : '';
      const values = activityId > 0 ? [...auth.departmentIds, activityId] : auth.departmentIds;
      const rows = (await query({
        query: `
          SELECT a.id AS assignment_id, a.activity_id, a.staff_user_id, a.target_date, a.notes, a.assigned_at, a.status,
                 act.activity_name, act.duration_text, act.sequence_no AS activity_sequence,
                 o.id AS output_id, o.output_code, o.service_description,
                 s.id AS standard_id, s.code AS standard_code, s.title AS standard_title,
                 u.full_name AS staff_name, u.email AS staff_email
          FROM sds_activity_assignments a
          JOIN sds_activities act ON act.id = a.activity_id
          JOIN sds_outputs o ON o.id = act.output_id
          JOIN sds_standards s ON s.id = o.standard_id
          LEFT JOIN users u ON u.id = a.staff_user_id
          WHERE a.status = 'active'
            AND a.department_id IN (${placeholders})
            ${activityFilter}
          ORDER BY s.code ASC, o.sequence_no ASC, act.sequence_no ASC, u.full_name ASC
        `,
        values,
      })) as Record<string, unknown>[];
      return NextResponse.json({ assignments: rows });
    }

    const placeholders = auth.departmentIds.map(() => '?').join(',');
    const rows = (await query({
      query: `
        SELECT s.*,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS owner_department_name,
          (SELECT COUNT(*) FROM sds_outputs o WHERE o.standard_id = s.id) AS output_count
        FROM sds_standards s
        LEFT JOIN departments d ON d.id = s.owner_department_id
        WHERE s.is_active = 1
          AND s.owner_department_id IN (${placeholders})
        ORDER BY s.code ASC
      `,
      values: auth.departmentIds,
    })) as Record<string, unknown>[];

    return NextResponse.json({ standards: rows });
  } catch (e) {
    console.error('sds hod GET', e);
    return NextResponse.json({ message: 'Error loading HOD SDS data' }, { status: 500 });
  }
}

/** Assign activity to one or more staff (many-to-many). */
export async function POST(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();

    const body = await request.json();
    const activityId = Number(body.activity_id);
    const staffIds: number[] = Array.isArray(body.staff_user_ids)
      ? body.staff_user_ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const notes = String(body.notes || '').trim() || null;
    let targetDate = String(body.target_date || '').trim() || null;

    if (!activityId || !staffIds.length) {
      return NextResponse.json({ message: 'activity_id and staff_user_ids required' }, { status: 400 });
    }

    const activities = (await query({
      query: `
        SELECT act.id, act.activity_name, act.duration_days, act.duration_text,
               s.owner_department_id, s.code AS standard_code, s.title AS standard_title, s.pillar
        FROM sds_activities act
        JOIN sds_outputs o ON o.id = act.output_id
        JOIN sds_standards s ON s.id = o.standard_id
        WHERE act.id = ?
      `,
      values: [activityId],
    })) as {
      id: number;
      activity_name: string;
      duration_days: number | null;
      duration_text: string | null;
      owner_department_id: number | null;
      standard_code: string;
      standard_title: string;
      pillar: string | null;
    }[];

    if (!activities.length) return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    const activity = activities[0];
    const ownerDept = Number(activity.owner_department_id || 0);
    if (!ownerDept || !auth.departmentIds.includes(ownerDept)) {
      return NextResponse.json({ message: 'Not authorized for this activity' }, { status: 403 });
    }

    if (!targetDate) {
      targetDate = addDaysIso(new Date(), activity.duration_days);
    }

    // Validate staff belong to visible departments
    const placeholders = staffIds.map(() => '?').join(',');
    const deptPlaceholders = auth.departmentIds.map(() => '?').join(',');
    const staffRows = (await query({
      query: `
        SELECT id, department_id, full_name, email FROM users
        WHERE id IN (${placeholders})
          AND department_id IN (${deptPlaceholders})
      `,
      values: [...staffIds, ...auth.departmentIds],
    })) as { id: number; department_id: number; full_name: string; email: string | null }[];
    if (staffRows.length !== staffIds.length) {
      return NextResponse.json({ message: 'One or more staff are not in your department' }, { status: 400 });
    }

    const assignerRows = (await query({
      query: 'SELECT full_name FROM users WHERE id = ? LIMIT 1',
      values: [auth.userId],
    })) as { full_name: string }[];
    const assignedByName = String(assignerRows[0]?.full_name || 'Your Head of Unit').trim();

    const { notifyStaffSdsAssignment } = await import('@/lib/sds/assignment-notify');

    let created = 0;
    for (const staff of staffRows) {
      const existing = (await query({
        query: `
          SELECT id FROM sds_activity_assignments
          WHERE activity_id = ? AND staff_user_id = ? AND status = 'active'
          LIMIT 1
        `,
        values: [activityId, staff.id],
      })) as { id: number }[];
      if (existing.length) continue;

      const insertResult = (await query({
        query: `
          INSERT INTO sds_activity_assignments
            (activity_id, staff_user_id, assigned_by, department_id, target_date, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
        `,
        values: [activityId, staff.id, auth.userId, staff.department_id || ownerDept, targetDate, notes],
      })) as { insertId?: number };
      created += 1;

      const assignmentId = Number(insertResult.insertId || 0);
      if (assignmentId > 0) {
        void notifyStaffSdsAssignment({
          staffUserId: staff.id,
          assignmentId,
          activityName: activity.activity_name,
          standardTitle: activity.standard_title,
          standardCode: activity.standard_code,
          pillar: activity.pillar,
          durationText: activity.duration_text,
          targetDate,
          assignedByName,
        });
      }
    }

    return NextResponse.json({
      message: 'Assigned',
      created,
      suggested_target_date: addDaysIso(new Date(), activity.duration_days),
      duration_text: activity.duration_text,
      notified: created,
    });
  } catch (e) {
    console.error('sds hod POST', e);
    return NextResponse.json({ message: 'Error assigning SDS activity' }, { status: 500 });
  }
}

/** Cancel or reassign (cancel + new staff). */
export async function PATCH(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();
    const body = await request.json();
    const assignmentId = Number(body.assignment_id);
    const action = String(body.action || '').trim();
    if (!assignmentId || !['cancel', 'update_target'].includes(action)) {
      return NextResponse.json({ message: 'assignment_id and action required' }, { status: 400 });
    }

    const rows = (await query({
      query: `
        SELECT a.id, a.department_id
        FROM sds_activity_assignments a
        WHERE a.id = ? AND a.status = 'active'
      `,
      values: [assignmentId],
    })) as { id: number; department_id: number | null }[];
    if (!rows.length) return NextResponse.json({ message: 'Assignment not found' }, { status: 404 });
    if (!rows[0].department_id || !auth.departmentIds.includes(Number(rows[0].department_id))) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }

    if (action === 'cancel') {
      await query({
        query: `
          UPDATE sds_activity_assignments
          SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = ?
          WHERE id = ?
        `,
        values: [auth.userId, assignmentId],
      });
      return NextResponse.json({ message: 'Cancelled' });
    }

    const targetDate = String(body.target_date || '').trim() || null;
    await query({
      query: 'UPDATE sds_activity_assignments SET target_date = ?, notes = COALESCE(?, notes) WHERE id = ?',
      values: [targetDate, String(body.notes || '').trim() || null, assignmentId],
    });
    return NextResponse.json({ message: 'Updated' });
  } catch (e) {
    console.error('sds hod PATCH', e);
    return NextResponse.json({ message: 'Error updating SDS assignment' }, { status: 500 });
  }
}
