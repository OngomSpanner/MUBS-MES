import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function GET(request: Request) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const url = new URL(request.url);
    const level = (url.searchParams.get('level') || 'all').trim();

    const where: string[] = ['is_active = 1'];
    const values: any[] = [];
    if (level !== 'all') {
      where.push('level = ?');
      values.push(level);
    }

    const rows = await query({
      query: `
        SELECT id, name, level, sort_order
        FROM mubs_programmes
        WHERE ${where.join(' AND ')}
        ORDER BY level ASC, sort_order ASC, name ASC
      `,
      values,
    }) as { id: number; name: string; level: string; sort_order: number }[];

    return NextResponse.json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name || '').trim(),
      level: String(r.level || '').trim(),
      sort_order: Number(r.sort_order ?? 0),
    })));
  } catch (e) {
    // If the table isn't deployed yet, fail softly.
    console.error('reference programmes GET', e);
    return NextResponse.json([]);
  }
}

