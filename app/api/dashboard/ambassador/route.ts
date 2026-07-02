import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import {
  queryManagedUnitActivityKpis,
  queryManagedUnitMonthlyReportingRate,
} from '@/lib/ambassador/department-compliance';
import { inPlaceholders } from '@/lib/department-head';
import { ensureActivityRfNarrativesTable } from '@/lib/activity-rf-narratives';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';
import { summarizeEnrollmentIndicators } from '@/lib/enrollment-indicators';
import { isHrManagedUnit } from '@/lib/ambassador/hr-unit';
import { isSchoolRegistrarManagedUnit } from '@/lib/ambassador/school-registrar';
import { getAmbassadorQuestionnaireProgress } from '@/lib/ambassador/questionnaire-progress';
import {
  MAIN_STRATEGIC_ACTIVITY_FILTER,
  RESULTS_FRAMEWORK_KPI_FILTER,
  RESULTS_FRAMEWORK_NARRATIVE_JOIN,
  buildResultsFrameworkActivitySelect,
  mapResultsFrameworkRows,
  summarizeResultsFramework,
  type ResultsFrameworkDbRow,
} from '@/lib/results-framework-query';

export async function GET() {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const { managedUnitId, managedUnitName } = ctx;
    const scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);

    if (scopedDepartmentIds.length === 0) {
      const [canManageHrWorkforce, canManageEnrollment] = await Promise.all([
        isHrManagedUnit(managedUnitId, managedUnitName),
        isSchoolRegistrarManagedUnit(managedUnitId, managedUnitName),
      ]);
      return NextResponse.json({
        managedUnitName,
        canManageHrWorkforce,
        canManageEnrollment,
        stats: {
          totalActivities: 0,
          overallProgress: 0,
          complianceRate: 0,
          onTrack: 0,
          inProgress: 0,
          delayed: 0,
          requiresAttention: 0,
          totalUnits: 0,
          departmentsReportedThisMonth: 0,
          rfIndicators: 0,
          rfAssessed: 0,
          rfUnderperformance: 0,
          rfAchievement: 0,
          rfOverachievement: 0,
          enrollmentProgrammes: 0,
          enrollmentProgrammeStudents: 0,
          enrollmentCourseUnits: 0,
          enrollmentCourseUnitStudents: 0,
        },
        rfSummary: summarizeResultsFramework([]),
        enrollment: null,
        financialYear: fyLabelForDateJulyJune(),
        subUnits: [],
        questionnaireProgress: {
          totals: {
            assignments: 0,
            notStarted: 0,
            inProgress: 0,
            completeDraft: 0,
            awaitingReview: 0,
            approved: 0,
            needsRevision: 0,
            fillRatePct: 0,
            approvalRatePct: 0,
          },
          byOutcome: [],
          priorityAssignments: [],
          insights: [],
        },
      });
    }

    const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

    const [activityKpis, monthlyReporting, subUnits] = await Promise.all([
      queryManagedUnitActivityKpis(scopedDepartmentIds),
      queryManagedUnitMonthlyReportingRate(scopedDepartmentIds),
      query({
        query: `
        SELECT 
          d.id,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) as department,
          ROUND(IFNULL(AVG(sa.progress), 0)) as progress,
          COUNT(sa.id) as activityCount
        FROM departments d
        LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
        WHERE d.id IN (${deptPlaceholders}) AND d.is_active = 1
        GROUP BY d.id, d.name, d.external_name
        ORDER BY department ASC
      `,
        values: scopedDepartmentIds,
      }) as Promise<{ id: number; department: string; progress: number; activityCount: number }[]>,
    ]);

    const totalUnits = monthlyReporting.totalDepartments;

    await ensureActivityRfNarrativesTable();
    const fyKey = fyLabelForDateJulyJune();
    const rfRows = (await query({
      query: `
        SELECT ${buildResultsFrameworkActivitySelect(fyKey, { hodApprovedOnly: false })}
        FROM strategic_activities sa
        LEFT JOIN standards st ON st.id = sa.standard_id
        LEFT JOIN departments d ON d.id = sa.department_id
        ${RESULTS_FRAMEWORK_NARRATIVE_JOIN}
        WHERE sa.department_id IN (${deptPlaceholders})
          AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
          AND ${RESULTS_FRAMEWORK_KPI_FILTER}
      `,
      values: [fyKey, ...scopedDepartmentIds],
    })) as ResultsFrameworkDbRow[];
    const rfSummary = summarizeResultsFramework(mapResultsFrameworkRows(rfRows, fyKey));
    const [canManageHrWorkforce, canManageEnrollment] = await Promise.all([
      isHrManagedUnit(managedUnitId, managedUnitName),
      isSchoolRegistrarManagedUnit(managedUnitId, managedUnitName),
    ]);
    const enrollment = canManageEnrollment ? await summarizeEnrollmentIndicators() : null;
    const questionnaireProgress = await getAmbassadorQuestionnaireProgress(managedUnitId);

    return NextResponse.json({
      managedUnitName,
      canManageHrWorkforce,
      canManageEnrollment,
      stats: {
        totalActivities: activityKpis.totalActivities,
        overallProgress: activityKpis.overallProgress,
        complianceRate: monthlyReporting.monthlyReportingRate,
        onTrack: activityKpis.onTrack,
        inProgress: activityKpis.inProgress,
        delayed: activityKpis.delayed,
        requiresAttention: activityKpis.requiresAttention,
        totalUnits,
        departmentsReportedThisMonth: monthlyReporting.departmentsReportedThisMonth,
        rfIndicators: rfSummary.total,
        rfAssessed: rfSummary.assessed,
        rfUnderperformance: rfSummary.underperformance,
        rfAchievement: rfSummary.achievement,
        rfOverachievement: rfSummary.overachievement,
        enrollmentProgrammes: enrollment?.programme.programmes ?? 0,
        enrollmentProgrammeStudents: enrollment?.programme.totalStudents ?? 0,
        enrollmentCourseUnits: enrollment?.courseUnit.courseUnits ?? 0,
        enrollmentCourseUnitStudents: enrollment?.courseUnit.totalStudents ?? 0,
      },
      rfSummary,
      enrollment,
      financialYear: fyKey,
      subUnits: subUnits.map((u) => ({
        id: u.id,
        name: u.department,
        progress: Math.min(100, Math.max(0, Number(u.progress || 0))),
        activityCount: Number(u.activityCount || 0),
      })),
      questionnaireProgress,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador Dashboard API Error:', error);
    return NextResponse.json(
      { message: 'Error fetching ambassador dashboard data', detail: message },
      { status: 500 }
    );
  }
}
