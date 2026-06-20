import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import {
  MAIN_STRATEGIC_ACTIVITY_FILTER,
  RESULTS_FRAMEWORK_KPI_FILTER,
  buildResultsFrameworkMatrixActivitySelect,
  mapResultsFrameworkMatrixRows,
  type ResultsFrameworkDbRow,
} from '@/lib/results-framework-query';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    await ensureHodReviewWorkflowSchema();
    const departmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (departmentIds.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const placeholders = inPlaceholders(departmentIds.length);

    const rows = (await query({
      query: `
        SELECT ${buildResultsFrameworkMatrixActivitySelect({ hodApprovedOnly: true })}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        WHERE sa.department_id IN (${placeholders})
          AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
        ORDER BY st.quality_standard ASC, st.output_standard ASC, sa.title ASC
      `,
      values: departmentIds,
    })) as ResultsFrameworkDbRow[];

    const matrixRows = mapResultsFrameworkMatrixRows(rows);

    return NextResponse.json({ rows: matrixRows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Department-head results-framework GET error:', error);
    return NextResponse.json({ message: 'Error loading results framework data', detail: message }, { status: 500 });
  }
}
