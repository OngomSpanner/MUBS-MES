import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import {
  sendAmbassadorReportReminders,
  type ReminderAudience,
} from '@/lib/ambassador-report-reminders';

export const dynamic = 'force-dynamic';

const VALID_AUDIENCES: ReminderAudience[] = [
  'not_started',
  'in_progress',
  'ready_to_submit',
  'hod_pending',
];

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { audience?: string };
    const audience = body.audience as ReminderAudience | undefined;
    if (!audience || !VALID_AUDIENCES.includes(audience)) {
      return NextResponse.json(
        { message: 'Invalid audience. Use not_started, in_progress, ready_to_submit, or hod_pending.' },
        { status: 400 },
      );
    }

    const result = await sendAmbassadorReportReminders(audience);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ambassador-reports remind error:', error);
    return NextResponse.json({ message: 'Error sending reminders', detail: message }, { status: 500 });
  }
}
