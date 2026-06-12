import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageStrategicStandards } from '@/lib/role-routing';
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
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { role?: string } | null;
    if (!decoded || !canManageStrategicStandards(decoded.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await ensureActivityRfNarrativesTable();
    const fyKey = parseResultsFrameworkFyParam(new URL(req.url).searchParams.get('financialYear'));

    const rows = (await query({
      query: `
        SELECT ${buildResultsFrameworkActivitySelect(fyKey)}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        ${RESULTS_FRAMEWORK_NARRATIVE_JOIN}
        WHERE ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
        ORDER BY d.name ASC, sa.title ASC
      `,
      values: [fyKey],
    })) as ResultsFrameworkDbRow[];

    const indicators = mapResultsFrameworkRows(rows, fyKey);

    return NextResponse.json({
      financialYear: fyKey,
      summary: summarizeResultsFramework(indicators),
      indicators,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin results-framework GET error:', error);
    return NextResponse.json({ message: 'Error loading results framework data', detail: message }, { status: 500 });
  }
}
