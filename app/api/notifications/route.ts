import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type NotificationFilter,
} from '@/lib/notifications';

export const dynamic = 'force-dynamic';

function parseFilter(raw: string | null): NotificationFilter {
  const allowed: NotificationFilter[] = ['All', 'Unread', 'Tasks', 'Deadlines', 'Feedback'];
  if (raw && allowed.includes(raw as NotificationFilter)) return raw as NotificationFilter;
  return 'All';
}

async function requireUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number } | null;
  return decoded?.userId ?? null;
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = parseFilter(searchParams.get('filter'));

    const notifications = await listNotificationsForUser(userId, filter);
    const unreadCount = await unreadNotificationCount(userId);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        is_read: n.is_read,
        is_urgent: n.is_urgent,
        action_url: n.action_url,
        created_at: n.created_at,
      })),
      unreadCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Notifications API GET Error:', error);
    return NextResponse.json({ message: 'Error fetching notifications', detail: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { markAllRead, id } = body as { markAllRead?: boolean; id?: number };

    if (markAllRead) {
      await markAllNotificationsRead(userId);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id) {
      await markNotificationRead(userId, Number(id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Notifications API PATCH Error:', error);
    return NextResponse.json({ message: message || 'Error updating notifications' }, { status: 500 });
  }
}
