import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import { inPlaceholders } from '@/lib/department-head';
import { ensureActivityRfNarrativesTable } from '@/lib/activity-rf-narratives';
import { fyLabelForDateJulyJune } from '@/lib/financial-year';
import { summarizeEnrollmentIndicators } from '@/lib/enrollment-indicators';
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
      return NextResponse.json({
        managedUnitName,
        stats: {
          totalActivities: 0,
          overallProgress: 0,
          complianceRate: 0,
          onTrack: 0,
          inProgress: 0,
          delayed: 0,
          totalUnits: 0,
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
        riskAlerts: [],
      });
    }

    const deptPlaceholders = inPlaceholders(scopedDepartmentIds.length);

    const kpiStats = (await query({
      query: `
        SELECT 
          COUNT(sa.id) as \`totalActivities\`,
          ROUND(IFNULL(AVG(sa.progress), 0)) as \`overallProgress\`,
          COALESCE(SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END), 0) as \`onTrack\`,
          COALESCE(SUM(CASE WHEN sa.status IN ('in_progress', 'pending') THEN 1 ELSE 0 END), 0) as \`inProgress\`,
          COALESCE(SUM(CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed') THEN 1 ELSE 0 END), 0) as \`delayed\`
        FROM strategic_activities sa
        WHERE sa.department_id IN (${deptPlaceholders}) AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
      `,
      values: scopedDepartmentIds,
    })) as {
      totalActivities: number;
      overallProgress: number;
      onTrack: number;
      inProgress: number;
      delayed: number;
    }[];

    const statsRow = kpiStats[0];

    const subUnits = (await query({
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
    })) as { id: number; department: string; progress: number; activityCount: number }[];

    const totalUnits = subUnits.length;
    const compliantUnits = (await query({
      query: `
        SELECT COUNT(DISTINCT u.department_id) as compliant_count
        FROM users u 
        JOIN staff_reports sr ON u.id = sr.submitted_by 
        WHERE u.department_id IN (${deptPlaceholders})
          AND sr.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `,
      values: scopedDepartmentIds,
    })) as { compliant_count: number }[];

    const compliantCount = Number(compliantUnits[0]?.compliant_count || 0);
    const complianceRate = totalUnits ? Math.round((compliantCount / totalUnits) * 100) : 0;

    const riskAlerts = (await query({
      query: `
        SELECT 
          sa.id,
          sa.title,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) as department,
          sa.status,
          sa.progress,
          sa.end_date,
          CASE WHEN sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) THEN 'Critical' ELSE 'Warning' END as statusLabel
        FROM strategic_activities sa
        JOIN departments d ON sa.department_id = d.id
        WHERE sa.department_id IN (${deptPlaceholders}) AND ${MAIN_STRATEGIC_ACTIVITY_FILTER}
        AND (sa.status = 'overdue' OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE()) OR (sa.status != 'completed' AND sa.end_date IS NOT NULL AND DATEDIFF(sa.end_date, CURDATE()) <= 7))
        ORDER BY sa.end_date ASC
        LIMIT 5
      `,
      values: scopedDepartmentIds,
    })) as {
      id: number;
      title: string;
      department: string;
      statusLabel: string;
      progress: number;
      end_date: string | null;
    }[];

    await ensureActivityRfNarrativesTable();
    const fyKey = fyLabelForDateJulyJune();
    const rfRows = (await query({
      query: `
        SELECT ${buildResultsFrameworkActivitySelect(fyKey)}
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
    const enrollment = await summarizeEnrollmentIndicators();

    return NextResponse.json({
      managedUnitName,
      stats: {
        totalActivities: Number(statsRow?.totalActivities ?? 0),
        overallProgress: Number(statsRow?.overallProgress ?? 0),
        complianceRate,
        onTrack: Number(statsRow?.onTrack ?? 0),
        inProgress: Number(statsRow?.inProgress ?? 0),
        delayed: Number(statsRow?.delayed ?? 0),
        totalUnits,
        rfIndicators: rfSummary.total,
        rfAssessed: rfSummary.assessed,
        rfUnderperformance: rfSummary.underperformance,
        rfAchievement: rfSummary.achievement,
        rfOverachievement: rfSummary.overachievement,
        enrollmentProgrammes: enrollment.programme.programmes,
        enrollmentProgrammeStudents: enrollment.programme.totalStudents,
        enrollmentCourseUnits: enrollment.courseUnit.courseUnits,
        enrollmentCourseUnitStudents: enrollment.courseUnit.totalStudents,
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
      riskAlerts: riskAlerts.map((r) => ({
        id: r.id,
        title: r.title,
        department: r.department,
        status: r.statusLabel,
        progress: Number(r.progress || 0),
        dueDate: r.end_date,
      })),
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
