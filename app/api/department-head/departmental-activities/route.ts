import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    let departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json(
        { activities: [], stats: { total: 0, onTrack: 0, inProgress: 0, delayed: 0 } },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }
    departmentIds = departmentIds.map((id: number) => Number(id));

    const placeholders = inPlaceholders(departmentIds.length);

    // Departmental (operational) activities:
    // - Not linked to strategic plan (source IS NULL/empty)
    // - Not a child task (parent_id IS NULL)
    // - Owned by one of the visible departments
    const rows = (await query({
      query: `
        SELECT 
          sa.*,
          d.name as unit_name,
          (SELECT COUNT(*) FROM activity_assignments aa WHERE aa.activity_id = sa.id) as assigned_staff,
          (SELECT COUNT(*) FROM activity_assignments aa WHERE aa.activity_id = sa.id AND aa.status = 'submitted') as pending_submissions
        FROM strategic_activities sa
        LEFT JOIN departments d ON d.id = sa.department_id
        WHERE sa.department_id IN (${placeholders})
          AND sa.parent_id IS NULL
          AND COALESCE(sa.source, '') = ''
          AND sa.activity_type = 'detailed'
        ORDER BY sa.end_date ASC
      `,
      values: [...departmentIds],
    })) as any[];

    const dbStatusMap: Record<string, string> = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'On Track',
      overdue: 'Delayed',
    };

    const activityIds = (rows || [])
      .map((r: any) => Number(r.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const progressFromReportStatus = (status: string | null): number | null => {
      if (!status) return null;
      const s = String(status).toLowerCase();
      if (s === 'evaluated' || s === 'completed') return 100;
      if (s === 'incomplete') return 50;
      if (s === 'not_done') return 0;
      if (s === 'submitted') return 50;
      return null;
    };

    const processProgressByActivity = new Map<number, number>();
    if (activityIds.length > 0) {
      const activityPlaceholders = inPlaceholders(activityIds.length);
      const processRows = (await query({
        query: `
          SELECT
            spa.id,
            spa.activity_id,
            spa.staff_id,
            spa.status as db_status,
            spa.start_date,
            spa.end_date,
            (
              SELECT sr2.status
              FROM staff_reports sr2
              WHERE sr2.process_assignment_id = spa.id
              ORDER BY sr2.updated_at DESC
              LIMIT 1
            ) as latest_report_status
          FROM staff_process_assignments spa
          WHERE spa.activity_id IN (${activityPlaceholders})
        `,
        values: [...activityIds],
      })) as any[];

      const containerIds = processRows
        .filter((p: any) => p.staff_id == null)
        .map((p: any) => Number(p.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);

      const subtasksByContainer = new Map<number, string[]>();
      if (containerIds.length > 0) {
        const containerPlaceholders = inPlaceholders(containerIds.length);
        try {
          const subRows = (await query({
            query: `
              SELECT
                s.process_assignment_id,
                COALESCE(
                  (
                    SELECT sr2.status
                    FROM staff_reports sr2
                    WHERE sr2.process_subtask_id = s.id
                    ORDER BY sr2.updated_at DESC
                    LIMIT 1
                  ),
                  s.status
                ) as status
              FROM staff_process_subtasks s
              WHERE s.process_assignment_id IN (${containerPlaceholders})
            `,
            values: [...containerIds],
          })) as any[];
          for (const r of subRows) {
            const pid = Number(r.process_assignment_id);
            if (!Number.isFinite(pid) || pid <= 0) continue;
            const list = subtasksByContainer.get(pid) ?? [];
            list.push(String(r.status ?? '').toLowerCase());
            subtasksByContainer.set(pid, list);
          }
        } catch {
          // staff_process_subtasks table may not exist in older schema.
        }
      }

      const subtaskProgressFromStatus = (raw: string): number => {
        const s = String(raw || '').toLowerCase();
        if (s === 'completed' || s === 'evaluated') return 100;
        if (s === 'submitted') return 50;
        if (s === 'in_progress') return 25;
        return 0;
      };

      const progressRowsByActivity = new Map<number, number[]>();
      for (const p of processRows) {
        const aid = Number(p.activity_id);
        if (!Number.isFinite(aid) || aid <= 0) continue;
        const isContainer = p.staff_id == null;
        let rowProgress = 0;

        if (isContainer) {
          const statuses = subtasksByContainer.get(Number(p.id)) ?? [];
          if (statuses.length > 0) {
            const sum = statuses.reduce((acc, s) => acc + subtaskProgressFromStatus(s), 0);
            rowProgress = Math.round(sum / statuses.length);
          } else {
            // Container without subtasks yet.
            rowProgress = 0;
          }
        } else {
          const derived = progressFromReportStatus(p.latest_report_status);
          if (derived != null) rowProgress = derived;
          else if (String(p.db_status || '').toLowerCase() === 'submitted') rowProgress = 50;
          else if (String(p.db_status || '').toLowerCase() === 'completed') rowProgress = 100;
          else rowProgress = 0;
        }

        const arr = progressRowsByActivity.get(aid) ?? [];
        arr.push(rowProgress);
        progressRowsByActivity.set(aid, arr);
      }

      for (const [aid, arr] of progressRowsByActivity.entries()) {
        if (arr.length > 0) {
          const avg = Math.round(arr.reduce((acc, n) => acc + n, 0) / arr.length);
          processProgressByActivity.set(aid, avg);
        }
      }
    }

    const activities = (rows || []).map((a: any) => {
      const fallbackProgress = a.progress != null ? Number(a.progress) : 0;
      const progress = processProgressByActivity.has(Number(a.id))
        ? Number(processProgressByActivity.get(Number(a.id)))
        : fallbackProgress;
      const status =
        progress >= 100
          ? 'On Track'
          : progress > 0
            ? 'In Progress'
            : dbStatusMap[a.status] || a.status;
      return { ...a, progress, status };
    });

    const stats = {
      total: activities.length,
      onTrack: activities.filter((a: any) => a.status === 'On Track').length,
      inProgress: activities.filter((a: any) => a.status === 'In Progress').length,
      delayed: activities.filter((a: any) => a.status === 'Delayed').length,
    };

    return NextResponse.json(
      { activities, stats },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('Departmental Activities API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching departmental activities', detail: error.message },
      { status: 500 }
    );
  }
}

