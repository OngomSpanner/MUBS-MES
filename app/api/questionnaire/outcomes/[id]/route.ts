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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureQuestionnaireObjectiveSchema();
    const { id } = await context.params;
    const body = await request.json();
    const type = body.type === 'Output' ? 'Output' : 'Outcome';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const strategicObjective = parseCoreObjective(body.strategic_objective);
    if (!label) return NextResponse.json({ message: 'Label is required' }, { status: 400 });
    if (!strategicObjective) {
      return NextResponse.json({ message: 'Strategic objective is required' }, { status: 400 });
    }
    await query({
      query: 'UPDATE q_outcomes SET type=?, label=?, strategic_objective=? WHERE id=?',
      values: [type, label, strategicObjective, id],
    });
    return NextResponse.json({ message: 'Updated' });
  } catch (e) {
    console.error('q_outcomes PUT', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const indicators = await query({
      query: 'SELECT COUNT(*) as cnt FROM q_indicators WHERE outcome_id=?',
      values: [id],
    }) as any[];
    if (indicators[0].cnt > 0) {
      return NextResponse.json(
        { message: 'Cannot delete — indicators exist under this outcome/output. Delete them first.' },
        { status: 409 }
      );
    }
    await query({ query: 'DELETE FROM q_outcomes WHERE id=?', values: [id] });
    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    console.error('q_outcomes DELETE', e);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
