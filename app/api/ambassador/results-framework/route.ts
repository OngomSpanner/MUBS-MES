import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import { inPlaceholders } from '@/lib/department-head';
import { ensureActivityRfNarrativesTable } from '@/lib/activity-rf-narratives';
import { parseResultsFrameworkFyParam } from '@/lib/results-framework-fy';
import {
  MAIN_STRATEGIC_ACTIVITY_FILTER,
  RESULTS_FRAMEWORK_KPI_FILTER,
  RESULTS_FRAMEWORK_NARRATIVE_JOIN,
  buildResultsFrameworkActivitySelect,
  mapResultsFrameworkRows,
  summarizeResultsFramework,
  type ResultsFrameworkDbRow,
} from '@/lib/results-framework-query';

export async function GET(req: Request) {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    await ensureActivityRfNarrativesTable();
    const fyKey = parseResultsFrameworkFyParam(new URL(req.url).searchParams.get('financialYear'));
    const scopedDepartmentIds = await getManagedUnitDepartmentIds(ctx.managedUnitId);
    if (scopedDepartmentIds.length === 0) {
      return NextResponse.json({
        managedUnitName: ctx.managedUnitName,
        financialYear: fyKey,
        summary: summarizeResultsFramework([]),
        indicators: [],
      });
    }

    const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

    const rows = (await query({
      query: `
        SELECT ${buildResultsFrameworkActivitySelect(fyKey)}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        ${RESULTS_FRAMEWORK_NARRATIVE_JOIN}
        WHERE sa.department_id IN (${deptPlaceholders})
          AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
        ORDER BY sa.title ASC
      `,
      values: [fyKey, ...scopedDepartmentIds],
    })) as ResultsFrameworkDbRow[];

    const indicators = mapResultsFrameworkRows(rows, fyKey);

    return NextResponse.json({
      managedUnitName: ctx.managedUnitName,
      financialYear: fyKey,
      summary: summarizeResultsFramework(indicators),
      indicators,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador results-framework GET error:', error);
    return NextResponse.json({ message: 'Error loading results framework data', detail: message }, { status: 500 });
  }
}
