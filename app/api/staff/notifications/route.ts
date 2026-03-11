import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const { searchParams } = new URL(req.url);
        const filter = searchParams.get('filter') || 'All'; // All | Unread | Tasks | Deadlines | Feedback

        let sql = `
            SELECT id, title, message, type, is_read, is_urgent, action_url, created_at, related_entity_type
            FROM notifications
            WHERE user_id = ?
        `;
        const values: any[] = [decoded.userId];

        if (filter === 'Unread') {
            sql += ' AND is_read = 0';
        } else if (filter === 'Tasks') {
            sql += ' AND (related_entity_type = ? OR title LIKE ?)';
            values.push('task', '%Task%');
        } else if (filter === 'Deadlines') {
            sql += ' AND (related_entity_type = ? OR title LIKE ?)';
            values.push('deadline', '%Deadline%');
        } else if (filter === 'Feedback') {
            sql += ' AND (related_entity_type = ? OR title LIKE ? OR message LIKE ?)';
            values.push('evaluation', '%Feedback%', '%evaluat%');
        }

        sql += ' ORDER BY created_at DESC LIMIT 100';

        const notifications = await query({ query: sql, values }) as any[];

        const unreadCount = (await query({
            query: 'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
            values: [decoded.userId]
        }) as any[])[0]?.c ?? 0;

        return NextResponse.json({
            notifications: notifications.map(n => ({
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type || 'info',
                is_read: Boolean(n.is_read),
                is_urgent: Boolean(n.is_urgent),
                action_url: n.action_url,
                created_at: n.created_at
            })),
            unreadCount: Number(unreadCount)
        });
    } catch (error: any) {
        console.error('Staff Notifications API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching notifications', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const body = await req.json().catch(() => ({}));
        const { markAllRead } = body;

        if (markAllRead) {
            await query({
                query: 'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
                values: [decoded.userId]
            });
            return NextResponse.json({ success: true, message: 'All notifications marked as read' });
        }

        const { id } = body;
        if (id) {
            await query({
                query: 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                values: [id, decoded.userId]
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    } catch (error: any) {
        console.error('Staff Notifications PATCH Error:', error);
        return NextResponse.json(
            { message: error.message || 'Error updating notifications' },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}
