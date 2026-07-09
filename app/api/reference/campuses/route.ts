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

export async function GET() {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // Campuses are stored as "office" units in departments (from your seed SQL).
    // We select anything that looks like a campus in name/external_name.
    const rows = await query({
      query: `
        SELECT id, COALESCE(NULLIF(TRIM(external_name),''), name) AS name
        FROM departments
        WHERE unit_type = 'office'
          AND (
            UPPER(name) LIKE '%CAMPUS%'
            OR UPPER(COALESCE(NULLIF(TRIM(external_name),''), name)) LIKE '%CAMPUS%'
          )
        ORDER BY name ASC
      `,
      values: [],
    }) as { id: number; name: string }[];

    return NextResponse.json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name || '').trim(),
    })));
  } catch (e) {
    console.error('reference campuses GET', e);
    return NextResponse.json([]);
  }
}

