import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { activity_id, title } = body;
    if (!activity_id) {
      return NextResponse.json({ message: 'activity_id is required' }, { status: 400 });
    }

    const rows = (await query({
      query: `
        SELECT sa.department_id, sa.created_by, d.hod_id
        FROM strategic_activities sa
        LEFT JOIN departments d ON sa.department_id = d.id
        WHERE sa.id = ?
      `,
      values: [activity_id]
    })) as any[];
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    }

    const notifyUserId = row.hod_id ?? row.created_by ?? null;
    const message = title
      ? `Reminder: "${title}" — please update progress.`
      : `Reminder: Activity #${activity_id} — please update progress.`;

    await query({
      query: `
        INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
        VALUES (?, 'Deadline Reminder', ?, 'strategic_activity', ?, 'warning', 0)
      `,
      values: [notifyUserId, message, activity_id]
    });

    return NextResponse.json({ message: 'Reminder sent.' });
  } catch (error: any) {
    console.error('Tracking reminder error:', error);
    return NextResponse.json(
      { message: 'Error sending reminder', detail: error?.message },
      { status: 500 }
    );
  }
}
