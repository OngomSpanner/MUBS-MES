import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { ensureQuestionnaireObjectiveSchema } from '@/lib/questionnaire-schema';
import { parseCoreObjective } from '@/lib/strategic-plan';

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
    await ensureQuestionnaireObjectiveSchema();
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!verifyToken(token)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const rows = await query({
      query: `SELECT o.id, o.type, o.label, o.strategic_objective, o.created_at,
                COUNT(DISTINCT i.id) AS indicator_count
              FROM q_outcomes o
              LEFT JOIN q_indicators i ON i.outcome_id = o.id
              GROUP BY o.id
              ORDER BY o.strategic_objective, o.type, o.label`,
    }) as any[];
    return NextResponse.json(rows);
  } catch (e) {
    console.error('q_outcomes GET', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureQuestionnaireObjectiveSchema();
    const body = await request.json();
    const type = body.type === 'Output' ? 'Output' : 'Outcome';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const strategicObjective = parseCoreObjective(body.strategic_objective);
    if (!label) return NextResponse.json({ message: 'Label is required' }, { status: 400 });
    if (!strategicObjective) {
      return NextResponse.json({ message: 'Strategic objective is required' }, { status: 400 });
    }
    const result = await query({
      query: 'INSERT INTO q_outcomes (type, label, strategic_objective) VALUES (?, ?, ?)',
      values: [type, label, strategicObjective],
    }) as any;
    return NextResponse.json(
      { id: result.insertId, type, label, strategic_objective: strategicObjective },
      { status: 201 },
    );
  } catch (e) {
    console.error('q_outcomes POST', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
