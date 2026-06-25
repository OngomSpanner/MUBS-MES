import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManagePortalSettings } from '@/lib/role-routing';
import {
  eventTypeLabel,
  listNotificationDeliveries,
  type NotificationDeliveryStatus,
} from '@/lib/notification-deliveries';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManagePortalSettings(decoded.role)) return null;
  return decoded;
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'all';
    const limit = Number(searchParams.get('limit') || 50);
    const offset = Number(searchParams.get('offset') || 0);

    const status =
      statusParam === 'sent' || statusParam === 'failed' || statusParam === 'skipped'
        ? (statusParam as NotificationDeliveryStatus)
        : 'all';

    const { deliveries, total } = await listNotificationDeliveries({ status, limit, offset });

    return NextResponse.json({
      deliveries: deliveries.map((d) => ({
        ...d,
        event_label: eventTypeLabel(d.event_type),
      })),
      total,
    });
  } catch (e) {
    console.error('admin notification-deliveries GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
