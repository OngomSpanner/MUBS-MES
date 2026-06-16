import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token) as { role?: string } | null;
    if (!decoded || !canManageStrategicStandards(decoded.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const locked = Boolean(body.locked);
    await query({ query: 'UPDATE q_indicators SET is_locked=? WHERE id=?', values: [locked ? 1 : 0, id] });
    return NextResponse.json({ message: locked ? 'Locked' : 'Unlocked', is_locked: locked });
  } catch (e) {
    console.error('q lock POST', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
