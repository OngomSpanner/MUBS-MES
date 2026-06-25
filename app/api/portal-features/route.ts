import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getMergedPortalFlags } from '@/lib/portal-feature-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const flags = await getMergedPortalFlags();
    return NextResponse.json({ flags });
  } catch (e) {
    console.error('portal-features GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
