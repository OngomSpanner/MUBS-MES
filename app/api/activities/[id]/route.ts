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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { title, strategic_objective, pillar, department_id, target_kpi, status, priority, parent_id, progress, start_date, end_date, timeline, description } = body;

    const parsedParentId = parent_id ? parseInt(parent_id, 10) : null;
    const departmentIdString = Array.isArray(department_id) ? department_id.join(',') : String(department_id || '');

    await query({
      query: `
        UPDATE strategic_activities 
        SET title = ?, strategic_objective = ?, pillar = ?, department_id = ?, target_kpi = ?, 
            status = ?, priority = ?, parent_id = ?, progress = ?, 
            start_date = ?, end_date = ?, timeline = ?, description = ?
        WHERE id = ?
      `,
      values: [
        title, strategic_objective, pillar, departmentIdString, target_kpi,
        status, priority || 'Medium', parsedParentId,
        progress ?? 0, start_date || null, end_date || null, timeline || null, description || null, id
      ]
    });

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
    await query({
      query: 'DELETE FROM strategic_activities WHERE id = ?',
      values: [id]
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