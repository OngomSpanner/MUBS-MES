import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// PUT — staff updates their own assignment status/commentary/actual_value
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, commentary, actual_value } = body;

    // Ensure staff can only update their own assignment
    const existing = await query({
      query: 'SELECT staff_id FROM staff_process_assignments WHERE id = ?',
      values: [id]
    }) as any[];

    if (!existing.length || existing[0].staff_id !== decoded.userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await query({
      query: `UPDATE staff_process_assignments SET status = ?, commentary = ?, actual_value = ? WHERE id = ?`,
      values: [status || 'pending', commentary || null, actual_value ?? null, id]
    });

    return NextResponse.json({ message: 'Assignment updated' });
  } catch (error) {
    console.error('Error updating staff assignment:', error);
    return NextResponse.json({ message: 'Error updating assignment' }, { status: 500 });
  }
}
