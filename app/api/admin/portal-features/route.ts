import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManagePortalSettings } from '@/lib/role-routing';
import { getAdminPortalFeatures, updatePortalFeatureFlags } from '@/lib/portal-feature-flags';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManagePortalSettings(decoded.role)) return null;
  return decoded;
}

export async function GET() {
  try {
    if (!await requireAdmin()) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const features = await getAdminPortalFeatures();
    return NextResponse.json({ features });
  } catch (e) {
    console.error('admin portal-features GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates = body?.updates;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ message: 'updates object is required' }, { status: 400 });
    }

    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'boolean') normalized[key] = value;
    }

    if (Object.keys(normalized).length === 0) {
      return NextResponse.json({ message: 'No valid updates' }, { status: 400 });
    }

    await updatePortalFeatureFlags(normalized, admin.userId!);
    const features = await getAdminPortalFeatures();
    return NextResponse.json({ message: 'Saved', features });
  } catch (e) {
    console.error('admin portal-features PUT', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
