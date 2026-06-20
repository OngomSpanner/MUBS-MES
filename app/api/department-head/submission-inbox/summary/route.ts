import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';

export const dynamic = 'force-dynamic';

async function authDepartmentIds(): Promise<number[] | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (departmentIds.length === 0) {
    return NextResponse.json({ message: 'No department assigned' }, { status: 403 });
  }
  return departmentIds;
}

export async function GET() {
  try {
    const auth = await authDepartmentIds();
    if (auth instanceof NextResponse) return auth;
    await ensureHodReviewWorkflowSchema();

    const placeholders = inPlaceholders(auth.length);
    const deptValues = [...auth];

    const count = async (sql: string, values: unknown[] = []) => {
      const rows = (await query({ query: sql, values })) as { c: number }[];
      return Number(rows[0]?.c ?? 0);
    };

    const [
      staffReports,
      teaching,
      proposals,
      questionnaire,
      benefits,
      workforce,
      skills,
      programme,
      courseUnit,
      resultsFramework,
    ] = await Promise.all([
      count(
        `SELECT COUNT(*) AS c FROM staff_reports sr
         LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
         LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
         LEFT JOIN strategic_activities p ON sa.parent_id = p.id
         LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
         LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
         LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
         WHERE sr.status = 'submitted'
           AND (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}) OR psa_sa.department_id IN (${placeholders}))`,
        [...deptValues, ...deptValues, ...deptValues],
      ),
      count(
        `SELECT
           (SELECT COUNT(*) FROM academic_course_unit_assignments WHERE department_id IN (${placeholders}) AND status = 'submitted') +
           (SELECT COUNT(*) FROM academic_programme_allocations WHERE department_id IN (${placeholders}) AND status = 'submitted') AS c`,
        [...deptValues, ...deptValues],
      ),
      count(
        `SELECT COUNT(*) AS c FROM ambassador_change_requests
         WHERE managed_unit_id IN (${placeholders}) AND status IN ('submitted', 'under_review')`,
        deptValues,
      ),
      count(
        `SELECT COUNT(*) AS c FROM q_indicator_submissions
         WHERE department_id IN (${placeholders}) AND hod_review_status = 'submitted'`,
        deptValues,
      ),
      count(
        `SELECT COUNT(*) AS c FROM staff_benefit_entries e
         INNER JOIN users u ON u.id = e.user_id
         WHERE u.department_id IN (${placeholders}) AND e.hod_review_status = 'submitted'`,
        deptValues,
      ),
      count(
        `SELECT COUNT(*) AS c FROM staff_workforce_assessment_counts w
         WHERE w.managed_unit_id IN (${placeholders}) AND w.hod_review_status = 'submitted'`,
        deptValues,
      ),
      count(
        `SELECT COUNT(*) AS c FROM staff_employment_skill_status s
         WHERE s.managed_unit_id IN (${placeholders}) AND s.hod_review_status = 'submitted'`,
        deptValues,
      ),
      count(`SELECT COUNT(*) AS c FROM staff_programme_enrollment WHERE hod_review_status = 'submitted'`),
      count(`SELECT COUNT(*) AS c FROM staff_course_unit_enrollment WHERE hod_review_status = 'submitted'`),
      count(
        `SELECT COUNT(*) AS c FROM activity_rf_narratives arn
         INNER JOIN strategic_activities sa ON sa.id = arn.activity_id
         WHERE sa.department_id IN (${placeholders}) AND arn.hod_review_status = 'submitted'`,
        deptValues,
      ),
    ]);

    return NextResponse.json({
      staffReports,
      teaching,
      proposals,
      questionnaire,
      hrReporting: benefits + workforce + skills,
      enrollment: programme + courseUnit,
      resultsFramework,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('submission-inbox summary error:', error);
    return NextResponse.json({ message: 'Error loading summary', detail: message }, { status: 500 });
  }
}
