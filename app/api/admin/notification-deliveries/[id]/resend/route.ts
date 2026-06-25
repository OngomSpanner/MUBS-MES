import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManagePortalSettings } from '@/lib/role-routing';
import { resendNotificationDelivery } from '@/lib/questionnaire-submission-notifications';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManagePortalSettings(decoded.role)) return null;
  return decoded;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const deliveryId = Number(id);
    if (!deliveryId) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    const result = await resendNotificationDelivery(deliveryId);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Notification resent successfully' });
  } catch (e) {
    console.error('admin notification-deliveries resend', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
