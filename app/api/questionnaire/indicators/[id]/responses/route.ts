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

/** GET all collected responses for an indicator (all assigned departments). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;

    const rows = await query({
      query: `SELECT r.metric_id, r.department_id, r.financial_year, r.value,
                     r.submitted_at, r.updated_at,
                     COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
              FROM q_responses r
              JOIN departments d ON d.id = r.department_id
              WHERE r.indicator_id = ?
              ORDER BY department_name, r.metric_id, r.financial_year`,
      values: [id],
    }) as any[];

    return NextResponse.json(rows);
  } catch (e) {
    console.error('q indicator responses GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
