import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    let rows: any[];
    try {
      rows = await query({
        query: `
          SELECT 
            sa.id, sa.title, sa.description, sa.pillar, sa.core_objective, sa.department_id, sa.target_kpi,
            sa.priority, sa.start_date, sa.end_date, sa.status, sa.progress, sa.parent_id,
            sa.activity_type, sa.created_by, sa.created_at,
            COALESCE(p.title, sa.title) AS display_title,
            COALESCE(p.description, sa.description) AS display_description,
            d.name AS department,
            parent.name AS faculty_office,
            p.title AS parent_title,
            CONCAT(IFNULL(DATE_FORMAT(sa.start_date, '%b %Y'), '-'), ' – ', IFNULL(DATE_FORMAT(sa.end_date, '%b %Y'), '-')) AS timeline
          FROM strategic_activities sa
          LEFT JOIN departments d ON sa.department_id = d.id
          LEFT JOIN departments parent ON d.parent_id = parent.id
          LEFT JOIN strategic_activities p ON sa.parent_id = p.id
          ORDER BY COALESCE(sa.parent_id, sa.id) ASC, sa.id ASC
          LIMIT 500
        `
      }) as any[];
    } catch (qErr: any) {
      const msg = String(qErr?.message || '');
      if (msg.includes('core_objective') || (qErr as any)?.code === 'ER_BAD_FIELD_ERROR') {
        rows = await query({
          query: `
            SELECT 
              sa.id, sa.title, sa.description, sa.pillar, sa.department_id, sa.target_kpi,
              sa.priority, sa.start_date, sa.end_date, sa.status, sa.progress, sa.parent_id,
              sa.activity_type, sa.created_by, sa.created_at,
              COALESCE(p.title, sa.title) AS display_title,
              COALESCE(p.description, sa.description) AS display_description,
              d.name AS department,
              parent.name AS faculty_office,
              p.title AS parent_title,
              CONCAT(IFNULL(DATE_FORMAT(sa.start_date, '%b %Y'), '-'), ' – ', IFNULL(DATE_FORMAT(sa.end_date, '%b %Y'), '-')) AS timeline
            FROM strategic_activities sa
            LEFT JOIN departments d ON sa.department_id = d.id
            LEFT JOIN departments parent ON d.parent_id = parent.id
            LEFT JOIN strategic_activities p ON sa.parent_id = p.id
            ORDER BY COALESCE(sa.parent_id, sa.id) ASC, sa.id ASC
            LIMIT 500
          `
        }) as any[];
      } else {
        throw qErr;
      }
    }

    const mainIdToDeptIds = new Map<number, number[]>();
    for (const r of rows) {
      const mainId = r.parent_id ?? r.id;
      if (!mainIdToDeptIds.has(mainId)) mainIdToDeptIds.set(mainId, []);
      if (r.department_id != null && !mainIdToDeptIds.get(mainId)!.includes(r.department_id)) {
        mainIdToDeptIds.get(mainId)!.push(r.department_id);
      }
    }

    const activities = rows.map((r) => {
      const mainId = r.parent_id ?? r.id;
      const department_ids = mainIdToDeptIds.get(mainId) ?? (r.department_id != null ? [r.department_id] : []);
      return {
        ...r,
        core_objective: r.core_objective ?? null,
        title: r.display_title ?? r.title,
        description: r.display_description ?? r.description,
        strategic_objective: r.display_description ?? r.description ?? '',
        department_ids,
        row_key: `${r.id}-${r.department_id ?? 'none'}`,
        department: r.department ?? '-',
        faculty_office: r.faculty_office ?? '-'
      };
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { message: 'Error fetching activities' },
      { status: 500 }
    );
  }
}

function mapStatusToDb(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'delayed' || s === 'overdue') return 'overdue';
  if (s === 'in progress' || s === 'on track' || s === 'in_progress') return 'in_progress';
  return 'pending';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      strategic_objective,
      description,
      pillar,
      core_objective,
      department_id,
      department_ids,
      target_kpi,
      status,
      priority,
      parent_id,
      start_date,
      end_date
    } = body;

    const desc = strategic_objective ?? description ?? '';
    const rawDeptIds = department_ids ?? (department_id != null && department_id !== '' ? [department_id] : []);
    const deptIds = Array.isArray(rawDeptIds) ? rawDeptIds.map((x: unknown) => Number(x)).filter((x) => !Number.isNaN(x) && x > 0) : [];
    const dbStatus = mapStatusToDb(status);

    let createdBy: number | null = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      if (token) {
        const decoded = verifyToken(token) as { userId?: number };
        if (decoded?.userId) createdBy = decoded.userId;
      }
    } catch (_) {}

    const pillarVal = pillar && String(pillar).trim() ? pillar : null;
    const coreObjVal = core_objective && String(core_objective).trim() ? core_objective : null;
    const sharedValues = [
      title,
      desc,
      pillarVal,
      coreObjVal,
      target_kpi || null,
      dbStatus,
      priority || 'Medium',
      parent_id ? Number(parent_id) : null,
      start_date || null,
      end_date || null,
      createdBy
    ];

    // One row per department in strategic_activities: first row = main, rest = detailed with parent_id
    if (deptIds.length === 0) {
      const result = await query({
        query: `
          INSERT INTO strategic_activities 
          (activity_type, source, title, description, pillar, core_objective, department_id, target_kpi, status, priority, parent_id, progress, start_date, end_date, created_by)
          VALUES ('main', 'strategic_plan', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?)
        `,
        values: sharedValues
      });
      return NextResponse.json(
        { message: 'Activity created successfully', id: (result as any).insertId },
        { status: 201 }
      );
    }

    const result = await query({
      query: `
        INSERT INTO strategic_activities 
        (activity_type, source, title, description, pillar, core_objective, department_id, target_kpi, status, priority, parent_id, progress, start_date, end_date, created_by)
        VALUES ('main', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `,
      values: [
        ...sharedValues.slice(0, 4),
        deptIds[0],
        ...sharedValues.slice(4)
      ]
    });
    const mainId = (result as any).insertId;

    for (let i = 1; i < deptIds.length; i++) {
      await query({
        query: `
          INSERT INTO strategic_activities 
          (activity_type, source, title, description, pillar, core_objective, department_id, target_kpi, status, priority, parent_id, progress, start_date, end_date, created_by)
          VALUES ('detailed', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        `,
        values: [
          title,
          desc,
          pillarVal,
          coreObjVal,
          deptIds[i],
          target_kpi || null,
          dbStatus,
          priority || 'Medium',
          mainId,
          start_date || null,
          end_date || null,
          createdBy
        ]
      });
    }

    return NextResponse.json(
      { message: 'Activity created successfully', id: mainId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { message: 'Error creating activity' },
      { status: 500 }
    );
  }
}