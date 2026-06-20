import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import { BENEFIT_TYPES } from '@/lib/hrms/staff-benefits';

export const dynamic = 'force-dynamic';

const BENEFIT_LABELS = Object.fromEntries(BENEFIT_TYPES.map((b) => [b.value, b.label]));

async function authReviewer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (departmentIds.length === 0) {
    return { error: NextResponse.json({ message: 'No department assigned' }, { status: 403 }) };
  }
  return { userId: decoded.userId, departmentIds };
}

type ReportCategory =
  | 'benefits'
  | 'workforce'
  | 'skills'
  | 'programme-enrollment'
  | 'course-unit-enrollment'
  | 'rf-narrative';

const TABLE_BY_CATEGORY: Record<string, string> = {
  benefits: 'staff_benefit_entries',
  workforce: 'staff_workforce_assessment_counts',
  skills: 'staff_employment_skill_status',
  'programme-enrollment': 'staff_programme_enrollment',
  'course-unit-enrollment': 'staff_course_unit_enrollment',
  'rf-narrative': 'activity_rf_narratives',
};

export async function GET(request: Request) {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const category = String(new URL(request.url).searchParams.get('category') || 'benefits') as ReportCategory;
    const placeholders = inPlaceholders(auth.departmentIds.length);
    const deptValues = auth.departmentIds;

    let items: Record<string, unknown>[] = [];

    if (category === 'benefits') {
      items = (await query({
        query: `
          SELECT e.id, e.financial_year_key, e.benefit_type, e.received, e.hod_review_status, e.updated_at,
                 TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.surname,''))) AS staff_name,
                 COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
          FROM staff_benefit_entries e
          INNER JOIN users u ON u.id = e.user_id
          LEFT JOIN departments d ON d.id = u.department_id
          WHERE u.department_id IN (${placeholders})
            AND e.hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE e.hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, e.updated_at DESC
        `,
        values: deptValues,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: BENEFIT_LABELS[String(r.benefit_type)] ?? r.benefit_type,
        subtitle: `${r.staff_name} · ${r.financial_year_key}`,
      }));
    } else if (category === 'workforce') {
      items = (await query({
        query: `
          SELECT w.id, w.assessment_detail, w.financial_year_key, w.count_value, w.hod_review_status, w.updated_at,
                 COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
          FROM staff_workforce_assessment_counts w
          LEFT JOIN departments d ON d.id = w.managed_unit_id
          WHERE w.managed_unit_id IN (${placeholders})
            AND w.hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE w.hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, w.updated_at DESC
        `,
        values: deptValues,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: r.assessment_detail,
        subtitle: `${r.department_name} · ${r.financial_year_key} · count ${r.count_value}`,
      }));
    } else if (category === 'skills') {
      items = (await query({
        query: `
          SELECT s.id, s.financial_year_key, s.hod_review_status, s.updated_at,
                 COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
          FROM staff_employment_skill_status s
          LEFT JOIN departments d ON d.id = s.managed_unit_id
          WHERE s.managed_unit_id IN (${placeholders})
            AND s.hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE s.hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, s.updated_at DESC
        `,
        values: deptValues,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: 'Employment & skill status',
        subtitle: `${r.department_name} · ${r.financial_year_key}`,
      }));
    } else if (category === 'programme-enrollment') {
      items = (await query({
        query: `
          SELECT id, programme_name, faculty_name, financial_year_key, hod_review_status, updated_at
          FROM staff_programme_enrollment
          WHERE hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, updated_at DESC
        `,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: r.programme_name,
        subtitle: `${r.faculty_name} · ${r.financial_year_key}`,
      }));
    } else if (category === 'course-unit-enrollment') {
      items = (await query({
        query: `
          SELECT id, course_unit_name, faculty_name, financial_year_key, hod_review_status, updated_at
          FROM staff_course_unit_enrollment
          WHERE hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, updated_at DESC
        `,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: r.course_unit_name,
        subtitle: `${r.faculty_name} · ${r.financial_year_key}`,
      }));
    } else if (category === 'rf-narrative') {
      items = (await query({
        query: `
          SELECT arn.id, arn.financial_year_key, arn.outcome_reason, arn.hod_review_status, arn.updated_at,
                 sa.title AS activity_title,
                 COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
          FROM activity_rf_narratives arn
          INNER JOIN strategic_activities sa ON sa.id = arn.activity_id
          LEFT JOIN departments d ON d.id = sa.department_id
          WHERE sa.department_id IN (${placeholders})
            AND arn.hod_review_status IN ('submitted', 'approved', 'returned')
          ORDER BY CASE arn.hod_review_status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END, arn.updated_at DESC
        `,
        values: deptValues,
      })) as Record<string, unknown>[];
      items = items.map((r) => ({
        ...r,
        category,
        title: r.activity_title,
        subtitle: `${r.department_name} · FY ${r.financial_year_key}`,
      }));
    }

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error loading reporting submissions', detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authReviewer();
    if ('error' in auth) return auth.error;
    await ensureHodReviewWorkflowSchema();

    const body = await request.json();
    const category = String(body.category || '').trim();
    const id = Number(body.id);
    const action = String(body.action || '').trim();
    const comment = String(body.comment || '').trim();
    const table = TABLE_BY_CATEGORY[category];

    if (!table || !id || !['approve', 'return'].includes(action)) {
      return NextResponse.json({ message: 'category, id, and action (approve|return) required' }, { status: 400 });
    }
    if (action === 'return' && !comment) {
      return NextResponse.json({ message: 'Comment required when returning' }, { status: 400 });
    }

    const status = action === 'approve' ? 'approved' : 'returned';
    await query({
      query: `
        UPDATE ${table}
        SET hod_review_status = ?, hod_reviewed_by = ?, hod_reviewed_at = NOW(), hod_review_comment = ?
        WHERE id = ?
      `,
      values: [status, auth.userId, comment || null, id],
    });

    return NextResponse.json({ message: action === 'approve' ? 'Approved' : 'Returned to ambassador' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error updating submission', detail: message }, { status: 500 });
  }
}
