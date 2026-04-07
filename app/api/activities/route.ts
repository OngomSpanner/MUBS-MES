import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { normalizeActivityUnitOfMeasure } from '@/lib/activity-unit-of-measure';

// Two-tier flat: Strategic Activity (parent_id IS NULL) = fixed goals; Weekly Task (parent_id set) = sibling tasks under one activity.

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    let rows: any[];
    try {
      rows = await query({
        query: `
          SELECT 
            sa.id, sa.title, sa.description, sa.pillar, sa.department_id, sa.target_kpi,
            sa.start_date, sa.end_date, sa.status, sa.progress, sa.parent_id,
            sa.activity_type, sa.created_by, sa.created_at, sa.actual_value, sa.kpi_target_value,
            sa.objective_id, sa.standard_id, sa.unit_of_measure,
            sa.target_fy25_26, sa.target_fy26_27, sa.target_fy27_28, sa.target_fy28_29, sa.target_fy29_30,
            COALESCE(p.title, sa.title) AS display_title,
            COALESCE(p.description, sa.description) AS display_description,
            d.name AS department,
            parent.name AS faculty_office,
            p.title AS parent_title,
            s.quality_standard AS quality_string,
            s.output_standard AS output_string,
            CONCAT(IFNULL(DATE_FORMAT(sa.start_date, '%b %Y'), '-'), ' – ', IFNULL(DATE_FORMAT(sa.end_date, '%b %Y'), '-')) AS timeline
          FROM strategic_activities sa
          LEFT JOIN departments d ON sa.department_id = d.id
          LEFT JOIN departments parent ON d.parent_id = parent.id
          LEFT JOIN strategic_activities p ON sa.parent_id = p.id
          LEFT JOIN standards s ON sa.standard_id = s.id
          WHERE COALESCE(TRIM(sa.source), '') <> ''
          ORDER BY sa.created_at DESC, sa.id DESC
          LIMIT 500
        `
      }) as any[];
    } catch (qErr: any) {
      const msg = String(qErr?.message || '');
      if ((qErr as any)?.code === 'ER_BAD_FIELD_ERROR') {
        rows = await query({
          query: `
            SELECT 
              sa.id, sa.title, sa.description, sa.pillar, sa.department_id, sa.target_kpi,
              sa.start_date, sa.end_date, sa.status, sa.progress, sa.parent_id,
              sa.activity_type, sa.created_by, sa.created_at, sa.actual_value, sa.kpi_target_value,
              sa.objective_id, sa.standard_id, sa.unit_of_measure,
              COALESCE(p.title, sa.title) AS display_title,
              COALESCE(p.description, sa.description) AS display_description,
              d.name AS department,
              parent.name AS faculty_office,
              p.title AS parent_title,
              s.quality_standard AS quality_string,
              s.output_standard AS output_string,
              CONCAT(IFNULL(DATE_FORMAT(sa.start_date, '%b %Y'), '-'), ' – ', IFNULL(DATE_FORMAT(sa.end_date, '%b %Y'), '-')) AS timeline
            FROM strategic_activities sa
            LEFT JOIN departments d ON sa.department_id = d.id
            LEFT JOIN departments parent ON d.parent_id = parent.id
            LEFT JOIN strategic_activities p ON sa.parent_id = p.id
            LEFT JOIN standards s ON sa.standard_id = s.id
            WHERE COALESCE(TRIM(sa.source), '') <> ''
            ORDER BY sa.created_at DESC, sa.id DESC
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

    const allDeptIds = new Set<number>();
    mainIdToDeptIds.forEach((ids) => ids.forEach((id) => allDeptIds.add(id)));
    const deptIdToName = new Map<number, string>();
    if (allDeptIds.size > 0) {
      const deptRows = await query({
        query: `SELECT id, name FROM departments WHERE id IN (${Array.from(allDeptIds).map(() => '?').join(',')})`,
        values: Array.from(allDeptIds)
      }) as any[];
      (deptRows || []).forEach((d: any) => deptIdToName.set(Number(d.id), d.name || ''));
    }

    // Admin Strategic Plan Activities: one row per (main activity, unit) so each unit has its own row
    const topLevelRows = rows.filter((r: any) => r.parent_id == null);
    const activities: any[] = [];

    for (const r of topLevelRows) {
      const mainId = r.id;
      const department_ids = mainIdToDeptIds.get(mainId) ?? (r.department_id != null ? [r.department_id] : []);
      const deptIdsToEmit = department_ids.length > 0 ? department_ids : [null];
      
      for (const deptId of deptIdsToEmit) {
        const department = deptId != null ? (deptIdToName.get(deptId) ?? '-') : (r.department ?? '-');
        
        let individualRow = r;
        if (deptId != null && department_ids.length > 1) {
          const detail = rows.find(row => row.parent_id === mainId && row.department_id === deptId);
          if (detail) {
            individualRow = detail;
          }
        } else if (deptId != null && r.department_id !== deptId) {
          const detail = rows.find(row => row.parent_id === mainId && row.department_id === deptId);
          if (detail) individualRow = detail;
        }

        activities.push({
          ...r,
          progress: individualRow.progress ?? 0,
          status: individualRow.status ?? 'pending',

          title: r.display_title ?? r.title,
          description: r.display_description ?? r.description,
          strategic_objective: r.display_description ?? r.description ?? '',
          department_ids,
          department_id: deptId,
          row_key: `${r.id}-${deptId ?? 'none'}`,
          department,
          faculty_office: r.faculty_office ?? '-',
          tier: r.parent_id == null ? 'strategic_activity' : 'weekly_task',
          strategic_activity_id: mainId
        });
      }
    }

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

// Legacy pillar mapping removed as DB column is now VARCHAR(255)

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      strategic_objective,
      objective_id,
      standard_id,
      unit_of_measure,
      description,
      pillar,
      department_id,
      department_ids,
      target_kpi,
      kpi_target_value,
      status,
      parent_id,
      start_date: reqStartDate,
      end_date: reqEndDate,
      target_fy25_26,
      target_fy26_27,
      target_fy27_28,
      target_fy28_29,
      target_fy29_30
    } = body;

    const uom = normalizeActivityUnitOfMeasure(
      typeof unit_of_measure === 'string' ? unit_of_measure : undefined
    );

    // Default to the 5-year Financial Years
    const start_date = reqStartDate || '2025-07-01';
    const end_date = reqEndDate || '2030-06-30';

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

    const runInsert = async () => {
      const pillarVal = pillar && String(pillar).trim() ? pillar : null;
      
      const values = [
        title, desc, pillarVal, target_kpi || null, kpi_target_value || null, dbStatus, null, start_date || null, end_date || null, createdBy, objective_id || null, standard_id || null, uom,
        target_fy25_26 || null, target_fy26_27 || null, target_fy27_28 || null, target_fy28_29 || null, target_fy29_30 || null
      ];

      if (deptIds.length === 0) {
        const queryStr = `INSERT INTO strategic_activities 
           (activity_type, source, title, description, pillar, department_id, target_kpi, kpi_target_value, status, parent_id, progress, start_date, end_date, created_by, objective_id, standard_id, unit_of_measure, target_fy25_26, target_fy26_27, target_fy27_28, target_fy28_29, target_fy29_30)
           VALUES ('main', 'strategic_plan', ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const result = await query({
          query: queryStr,
          values: values
        });
        return { id: (result as any).insertId };
      }

      const mainDeptId = deptIds.length > 1 ? null : deptIds[0];
      const detailStartIndex = deptIds.length > 1 ? 0 : 1;
      const childDeptIds = deptIds.slice(detailStartIndex);

      const mainValues = [
        title, desc, pillarVal, mainDeptId, target_kpi || null, kpi_target_value || null, dbStatus, null, start_date || null, end_date || null, createdBy, objective_id || null, standard_id || null, uom,
        target_fy25_26 || null, target_fy26_27 || null, target_fy27_28 || null, target_fy28_29 || null, target_fy29_30 || null
      ];

      const result = await query({
        query: `
          INSERT INTO strategic_activities 
          (activity_type, source, title, description, pillar, department_id, target_kpi, kpi_target_value, status, parent_id, progress, start_date, end_date, created_by, objective_id, standard_id, unit_of_measure, target_fy25_26, target_fy26_27, target_fy27_28, target_fy28_29, target_fy29_30)
          VALUES ('main', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: mainValues
      });
      const mainId = (result as any).insertId;

      for (const deptId of childDeptIds) {
        await query({
          query: `
            INSERT INTO strategic_activities 
            (activity_type, source, title, description, pillar, department_id, target_kpi, kpi_target_value, status, parent_id, progress, start_date, end_date, created_by, objective_id, standard_id, unit_of_measure, target_fy25_26, target_fy26_27, target_fy27_28, target_fy28_29, target_fy29_30)
            VALUES ('detailed', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          values: [title, desc, pillarVal, deptId, target_kpi || null, kpi_target_value || null, dbStatus, mainId, start_date || null, end_date || null, createdBy, objective_id || null, standard_id || null, uom, target_fy25_26 || null, target_fy26_27 || null, target_fy27_28 || null, target_fy28_29 || null, target_fy29_30 || null]
        });
      }
      return { id: mainId };
    };

    try {
      const { id } = await runInsert();
      return NextResponse.json(
        { message: 'Activity created successfully', id },
        { status: 201 }
      );
    } catch (firstErr: any) {
      throw firstErr;
    }
  } catch (error: any) {
    const errMessage = error?.message || 'Error creating activity';
    console.error('Error creating activity:', error);
    return NextResponse.json(
      {
        message: process.env.NODE_ENV === 'production' ? 'Error creating activity' : errMessage,
        ...(process.env.NODE_ENV !== 'production' && { detail: errMessage })
      },
      { status: 500 }
    );
  }
}