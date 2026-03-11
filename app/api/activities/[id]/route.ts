import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const activity = await query({
      query: 'SELECT * FROM strategic_activities WHERE id = ?',
      values: [id]
    });

    if (!(activity as any[]).length) {
      return NextResponse.json(
        { message: 'Activity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json((activity as any[])[0]);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { message: 'Error fetching activity' },
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      progress,
      start_date,
      end_date
    } = body;

    const desc = strategic_objective ?? description ?? '';
    const rawDeptIds = department_ids ?? (department_id != null && department_id !== '' ? [department_id] : []);
    const deptIds = Array.isArray(rawDeptIds) ? rawDeptIds.map((x: unknown) => Number(x)).filter((x) => !Number.isNaN(x) && x > 0) : [];
    const dbStatus = mapStatusToDb(status);

    const existing = await query({
      query: 'SELECT id, parent_id FROM strategic_activities WHERE id = ?',
      values: [id]
    }) as { id: number; parent_id: number | null }[];
    if (!existing.length) {
      return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    }
    const mainId = existing[0].parent_id ?? existing[0].id;

    const pillarVal = pillar && String(pillar).trim() ? pillar : null;
    const coreObjVal = core_objective && String(core_objective).trim() ? core_objective : null;
    const mainDeptId = deptIds[0] ?? null;
    await query({
      query: `
        UPDATE strategic_activities 
        SET title = ?, description = ?, pillar = ?, core_objective = ?, department_id = ?, target_kpi = ?, status = ?, priority = ?, parent_id = ?, progress = ?, start_date = ?, end_date = ?
        WHERE id = ?
      `,
      values: [
        title,
        desc,
        pillarVal,
        coreObjVal,
        mainDeptId,
        target_kpi || null,
        dbStatus,
        priority || 'Medium',
        parent_id ? Number(parent_id) : null,
        progress ?? 0,
        start_date || null,
        end_date || null,
        mainId
      ]
    });

    const children = await query({
      query: 'SELECT id FROM strategic_activities WHERE parent_id = ? ORDER BY id',
      values: [mainId]
    }) as { id: number }[];
    const childIds = children.map((c) => c.id);
    const childDeptIds = deptIds.slice(1);

    for (let i = 0; i < childIds.length; i++) {
      if (i < childDeptIds.length) {
        await query({
          query: 'UPDATE strategic_activities SET department_id = ?, title = ?, description = ?, pillar = ?, core_objective = ? WHERE id = ?',
          values: [childDeptIds[i], title, desc, pillarVal, coreObjVal, childIds[i]]
        });
      } else {
        await query({ query: 'DELETE FROM strategic_activities WHERE id = ?', values: [childIds[i]] });
      }
    }
    for (let i = childIds.length; i < childDeptIds.length; i++) {
      await query({
        query: `
          INSERT INTO strategic_activities (activity_type, source, title, description, pillar, core_objective, department_id, target_kpi, status, priority, parent_id, progress, start_date, end_date)
          VALUES ('detailed', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `,
        values: [title, desc, pillarVal, coreObjVal, childDeptIds[i], target_kpi || null, dbStatus, priority || 'Medium', mainId, start_date || null, end_date || null]
      });
    }

    return NextResponse.json({ message: 'Activity updated successfully' });
  } catch (error: any) {
    console.error('Error updating activity. Details:', error.message || error);
    return NextResponse.json(
      { message: 'Error updating activity: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const row = await query({
      query: 'SELECT id, parent_id FROM strategic_activities WHERE id = ?',
      values: [id]
    }) as { id: number; parent_id: number | null }[];
    if (!row.length) {
      return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    }
    const mainId = row[0].parent_id ?? row[0].id;
    await query({
      query: 'DELETE FROM strategic_activities WHERE id = ? OR parent_id = ?',
      values: [mainId, mainId]
    });

    return NextResponse.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json(
      { message: 'Error deleting activity' },
      { status: 500 }
    );
  }
}