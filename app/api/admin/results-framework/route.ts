import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { canManageStrategicStandards } from '@/lib/role-routing';
import {
  MAIN_STRATEGIC_ACTIVITY_FILTER,
  RESULTS_FRAMEWORK_KPI_FILTER,
  buildResultsFrameworkMatrixActivitySelect,
  mapResultsFrameworkMatrixRows,
  type ResultsFrameworkDbRow,
} from '@/lib/results-framework-query';

export async function GET() {
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

    await ensureHodReviewWorkflowSchema();

    const rows = (await query({
      query: `
        SELECT ${buildResultsFrameworkMatrixActivitySelect()}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        WHERE ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
        ORDER BY st.quality_standard ASC, st.output_standard ASC, sa.title ASC
      `,
    })) as ResultsFrameworkDbRow[];

    const matrixRows = mapResultsFrameworkMatrixRows(rows);

    return NextResponse.json({ rows: matrixRows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin results-framework GET error:', error);
    return NextResponse.json({ message: 'Error loading results framework data', detail: message }, { status: 500 });
  }
}
