import { query } from '@/lib/db';

export type AppNotificationRow = {
  id: number;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  is_urgent: boolean;
  action_url: string | null;
  created_at: string;
};

export type NotificationFilter = 'All' | 'Unread' | 'Tasks' | 'Deadlines' | 'Feedback';

export async function insertAppNotification(args: {
  userId: number;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  relatedEntityType?: string;
  relatedEntityId?: number;
  actionUrl?: string | null;
  isUrgent?: boolean;
}): Promise<void> {
  await query({
    query: `
      INSERT INTO notifications (
        user_id, title, message, related_entity_type, related_entity_id, type, is_urgent, action_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    values: [
      args.userId,
      args.title,
      args.message,
      args.relatedEntityType ?? null,
      args.relatedEntityId ?? null,
      args.type ?? 'info',
      args.isUrgent ? 1 : 0,
      args.actionUrl ?? null,
    ],
  });
}

export async function listNotificationsForUser(
  userId: number,
  filter: NotificationFilter = 'All'
): Promise<AppNotificationRow[]> {
  let sql = `
    SELECT id, title, message, type, is_read, is_urgent, action_url, created_at
    FROM notifications
    WHERE user_id = ?
  `;
  const values: (string | number)[] = [userId];

  if (filter === 'Unread') {
    sql += ' AND is_read = 0';
  } else if (filter === 'Tasks') {
    sql += ' AND (related_entity_type = ? OR title LIKE ?)';
    values.push('task', '%Task%');
  } else if (filter === 'Deadlines') {
    sql += ' AND (related_entity_type = ? OR title LIKE ?)';
    values.push('deadline', '%Deadline%');
  } else if (filter === 'Feedback') {
    sql += ' AND (related_entity_type IN (?, ?) OR title LIKE ? OR message LIKE ?)';
    values.push('evaluation', 'questionnaire_indicator', '%Feedback%', '%evaluat%');
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const rows = (await query({ query: sql, values })) as AppNotificationRow[];
  return rows.map((n) => ({
    ...n,
    is_read: Boolean(n.is_read),
    is_urgent: Boolean(n.is_urgent),
    type: n.type || 'info',
  }));
}

export async function unreadNotificationCount(userId: number): Promise<number> {
  const rows = (await query({
    query: 'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
    values: [userId],
  })) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await query({
    query: 'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    values: [userId],
  });
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  await query({
    query: 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    values: [notificationId, userId],
  });
}
