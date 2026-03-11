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
      query: 'SELECT id, title FROM strategic_activities WHERE id = ?',
      values: [activity_id]
    })) as any[];
    if (!rows[0]) {
      return NextResponse.json({ message: 'Activity not found' }, { status: 404 });
    }

    const activityTitle = title ?? rows[0].title;
    const message = `Activity escalated for immediate intervention: "${activityTitle}" (ID: ${activity_id}).`;

    await query({
      query: `
        INSERT INTO notifications (user_id, title, message, related_entity_type, related_entity_id, type, is_urgent)
        VALUES (NULL, 'Activity Escalation', ?, 'strategic_activity', ?, 'danger', 1)
      `,
      values: [message, activity_id]
    });

    await query({
      query: `
        INSERT INTO system_logs (user_id, action, entity_type, entity_id, new_values)
        VALUES (?, 'Escalate Activity', 'strategic_activity', ?, ?)
      `,
      values: [decoded.userId, activity_id, JSON.stringify({ title: activityTitle, escalated_at: new Date().toISOString() })]
    });

    return NextResponse.json({ message: 'Escalation submitted. Senior management has been notified.' });
  } catch (error: any) {
    console.error('Tracking escalate error:', error);
    return NextResponse.json(
      { message: 'Error submitting escalation', detail: error?.message },
      { status: 500 }
    );
  }
}
