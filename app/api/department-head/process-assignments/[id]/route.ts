import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// PUT — update assignment status/commentary from HOD
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, commentary, start_date, end_date } = body;

    await query({
      query: `UPDATE staff_process_assignments SET status = ?, commentary = ?, start_date = ?, end_date = ? WHERE id = ?`,
      values: [status || 'pending', commentary || null, start_date || null, end_date || null, id]
    });

    return NextResponse.json({ message: 'Assignment updated' });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ message: 'Error updating assignment' }, { status: 500 });
  }
}

// DELETE — remove an assignment
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await query({
      query: 'DELETE FROM staff_process_assignments WHERE id = ?',
      values: [id]
    });

    return NextResponse.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ message: 'Error deleting assignment' }, { status: 500 });
  }
}
