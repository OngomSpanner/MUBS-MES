import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { ensureQuestionnaireObjectiveSchema, ensureQuestionnaireSubMetricsSchema } from '@/lib/questionnaire-schema';
import { ensureIndicatorTargetsSchema } from '@/lib/questionnaire-metric-targets';
import { ensureResultFormulasSchema } from '@/lib/questionnaire/result-formulas';
import { buildStrategyResults } from '@/lib/questionnaire/compute-strategy-results';

export const dynamic = 'force-dynamic';

async function requireStrategyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function GET(request: Request) {
  try {
    if (!(await requireStrategyAdmin())) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await ensureHodReviewWorkflowSchema();
    await ensureQuestionnaireObjectiveSchema();
    await ensureQuestionnaireSubMetricsSchema();
    await ensureIndicatorTargetsSchema();
    await ensureResultFormulasSchema();

    const approvedOnly = new URL(request.url).searchParams.get('approvedOnly') === '1';
    const payload = await buildStrategyResults(approvedOnly);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error loading strategy results', detail: message }, { status: 500 });
  }
}
