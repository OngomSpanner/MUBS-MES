import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { getAmbassadorReportsSummary } from '@/lib/admin/ambassador-reports-aggregate';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const summary = await getAmbassadorReportsSummary();
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ambassador-reports summary error:', error);
    return NextResponse.json({ message: 'Error loading ambassador reports', detail: message }, { status: 500 });
  }
}
