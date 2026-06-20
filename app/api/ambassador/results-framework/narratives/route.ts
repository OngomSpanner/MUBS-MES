import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import {
  getActivityRfNarrative,
  upsertActivityRfNarrative,
  validateNarrativeForStatus,
} from '@/lib/activity-rf-narratives';
import { isPracticeType } from '@/lib/results-framework';
import { parseResultsFrameworkFyParam } from '@/lib/results-framework-fy';
import { parseSubmitForReview } from '@/lib/hod-review-workflow';
import {
  MAIN_STRATEGIC_ACTIVITY_FILTER,
  RESULTS_FRAMEWORK_KPI_FILTER,
  RESULTS_FRAMEWORK_NARRATIVE_JOIN,
  buildResultsFrameworkActivitySelect,
  mapResultsFrameworkRows,
  type ResultsFrameworkDbRow,
} from '@/lib/results-framework-query';

export async function POST(request: Request) {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const body = await request.json();
    const activityId = Number(body.activityId);
    const outcomeReason = String(body.outcomeReason || '').trim();
    const practiceTypeRaw = String(body.practiceType || '').trim();
    const practiceType = isPracticeType(practiceTypeRaw) ? practiceTypeRaw : null;

    if (!Number.isFinite(activityId) || activityId <= 0) {
      return NextResponse.json({ message: 'Invalid activity' }, { status: 400 });
    }

    const scopedDepartmentIds = await getManagedUnitDepartmentIds(ctx.managedUnitId);
    if (scopedDepartmentIds.length === 0) {
      return NextResponse.json({ message: 'No managed unit scope' }, { status: 403 });
    }

    const fyKey = parseResultsFrameworkFyParam(body.financialYear);
    const placeholders = scopedDepartmentIds.map(() => '?').join(', ');

    const activityRows = (await query({
      query: `
        SELECT ${buildResultsFrameworkActivitySelect(fyKey)}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        ${RESULTS_FRAMEWORK_NARRATIVE_JOIN}
        WHERE sa.id = ?
          AND sa.department_id IN (${placeholders})
          AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
        LIMIT 1
      `,
      values: [fyKey, activityId, ...scopedDepartmentIds],
    })) as ResultsFrameworkDbRow[];

    const mapped = mapResultsFrameworkRows(activityRows, fyKey);
    const indicator = mapped[0];
    if (!indicator) {
      return NextResponse.json({ message: 'Activity not found in your unit scope' }, { status: 404 });
    }

    const validationError = validateNarrativeForStatus(
      indicator.performanceStatus,
      outcomeReason,
      practiceType
    );
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    await upsertActivityRfNarrative({
      activityId,
      userId: ctx.userId,
      outcomeReason,
      practiceType,
      financialYearKey: fyKey,
      submitForReview: parseSubmitForReview(body),
    });

    const saved = await getActivityRfNarrative(activityId, fyKey);

    return NextResponse.json({
      message: 'Results Framework narrative saved',
      narrative: saved,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador RF narrative POST error:', error);
    return NextResponse.json({ message: message || 'Error saving narrative' }, { status: 500 });
  }
}
