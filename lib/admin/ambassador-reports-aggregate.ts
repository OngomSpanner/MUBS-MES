import { query } from '@/lib/db';
import { ensureHodReviewWorkflowSchema } from '@/lib/hod-review-workflow';
import type { HodReviewStatus } from '@/lib/hod-review-workflow-constants';
import { coreObjectiveShortTitle } from '@/lib/strategic-plan';

export type ReportingCategory = 'not-completed' | 'awaiting-review' | 'completed' | 'needs-revision';
export type ProgressStatus = 'not-started' | 'partial' | 'complete';

export type AssignmentRow = {
  indicatorId: number;
  departmentId: number;
  departmentName: string;
  indicatorText: string;
  outcomeLabel: string;
  outcomeType: string;
  strategicObjective: string | null;
  hodReviewStatus: HodReviewStatus;
  filled: number;
  total: number;
  progressStatus: ProgressStatus;
  reportingCategory: ReportingCategory;
  submittedAt: string | null;
  hodReviewedAt: string | null;
  ambassadorUserId: number | null;
  ambassadorName: string | null;
  ambassadorEmail: string | null;
};

export type DepartmentRollup = {
  departmentId: number;
  departmentName: string;
  ambassadorName: string | null;
  ambassadorEmail: string | null;
  assignments: number;
  notStarted: number;
  inProgress: number;
  completeDraft: number;
  awaitingReview: number;
  approved: number;
  needsRevision: number;
  fillRatePct: number;
  approvalRatePct: number;
};

export type ObjectiveRollup = {
  objective: string;
  objectiveShort: string;
  assignments: number;
  notStarted: number;
  inProgress: number;
  awaitingReview: number;
  approved: number;
  needsRevision: number;
  fillRatePct: number;
  approvalRatePct: number;
};

export type OutcomeRollup = {
  outcomeKey: string;
  outcomeLabel: string;
  outcomeType: string;
  strategicObjective: string | null;
  objectiveShort: string;
  assignments: number;
  notStarted: number;
  inProgress: number;
  awaitingReview: number;
  approved: number;
  needsRevision: number;
  fillRatePct: number;
  approvalRatePct: number;
};

export type HodDepartmentRollup = {
  departmentId: number;
  departmentName: string;
  pendingReview: number;
  approved: number;
  returned: number;
  draft: number;
  approvalRatePct: number;
};

export type AgingRow = {
  indicatorId: number;
  departmentId: number;
  departmentName: string;
  indicatorText: string;
  outcomeLabel: string;
  ambassadorName: string | null;
  submittedAt: string;
  daysPending: number;
};

export type AmbassadorReportsSummary = {
  generatedAt: string;
  totals: {
    assignments: number;
    notStarted: number;
    inProgress: number;
    completeDraft: number;
    awaitingReview: number;
    approved: number;
    needsRevision: number;
    fillRatePct: number;
    approvalRatePct: number;
    hodPendingCount: number;
    avgHodPendingDays: number;
  };
  assignments: AssignmentRow[];
  byDepartment: DepartmentRollup[];
  byObjective: ObjectiveRollup[];
  byOutcome: OutcomeRollup[];
  hodByDepartment: HodDepartmentRollup[];
  agingQueue: AgingRow[];
};

function reportingCategory(
  progress: ProgressStatus,
  hod: HodReviewStatus,
): ReportingCategory {
  if (hod === 'returned') return 'needs-revision';
  if (hod === 'submitted') return 'awaiting-review';
  if (hod === 'approved') return 'completed';
  return 'not-completed';
}

function progressStatus(filled: number, total: number): ProgressStatus {
  if (total === 0 || filled === 0) return 'not-started';
  if (filled < total) return 'partial';
  return 'complete';
}

function outcomeKey(type: string, label: string): string {
  return `${type}::${label}`;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

async function loadAmbassadorsByUnit(): Promise<Map<number, { userId: number; name: string; email: string }>> {
  const rows = (await query({
    query: `
      SELECT u.id, u.full_name, u.email, u.managed_unit_id, u.role
      FROM users u
      WHERE u.status = 'Active'
        AND u.managed_unit_id IS NOT NULL
        AND (
          u.role LIKE '%Ambassador%'
          OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = u.id AND LOWER(ur.role) IN ('ambassador', 'strategic_plan_ambassador')
          )
        )
    `,
  })) as { id: number; full_name: string | null; email: string; managed_unit_id: number; role: string | null }[];

  const map = new Map<number, { userId: number; name: string; email: string }>();
  for (const row of rows) {
    const unitId = Number(row.managed_unit_id);
    if (!unitId || map.has(unitId)) continue;
    map.set(unitId, {
      userId: row.id,
      name: String(row.full_name || '').trim() || 'Ambassador',
      email: String(row.email || '').trim(),
    });
  }
  return map;
}

async function loadRawAssignmentRows(departmentId?: number): Promise<Record<string, unknown>[]> {
  const deptFilter = departmentId != null ? 'WHERE qid.department_id = ?' : '';
  const values = departmentId != null ? [departmentId] : [];

  return (await query({
    query: `
      SELECT qid.indicator_id, qid.department_id,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name,
             i.indicator_text, o.label AS outcome_label, o.type AS outcome_type,
             o.strategic_objective,
             COALESCE(qis.hod_review_status, 'draft') AS hod_review_status,
             qis.submitted_at, qis.hod_reviewed_at,
             (SELECT COUNT(*) FROM q_metrics m WHERE m.indicator_id = i.id) AS metric_count,
             (SELECT COUNT(*) FROM q_indicator_fys f WHERE f.indicator_id = i.id) AS fy_count,
             (SELECT COUNT(*)
              FROM q_responses r
              WHERE r.indicator_id = i.id AND r.department_id = qid.department_id
                AND r.value IS NOT NULL AND TRIM(r.value) <> '') AS filled
      FROM q_indicator_departments qid
      JOIN q_indicators i ON i.id = qid.indicator_id
      JOIN q_outcomes o ON o.id = i.outcome_id
      JOIN departments d ON d.id = qid.department_id
      LEFT JOIN q_indicator_submissions qis
        ON qis.indicator_id = qid.indicator_id AND qis.department_id = qid.department_id
      ${deptFilter}
      ORDER BY o.strategic_objective, o.label, i.indicator_text, department_name
    `,
    values,
  })) as Record<string, unknown>[];
}

function mapRawRowsToAssignments(
  rawRows: Record<string, unknown>[],
  ambassadors: Map<number, { userId: number; name: string; email: string }>,
): AssignmentRow[] {
  return rawRows.map((row) => {
    const metricCount = Number(row.metric_count ?? 0);
    const fyCount = Number(row.fy_count ?? 0);
    const total = metricCount * fyCount;
    const filled = Number(row.filled ?? 0);
    const hod = String(row.hod_review_status || 'draft') as HodReviewStatus;
    const progress = progressStatus(filled, total);
    const deptId = Number(row.department_id);
    const ambassador = ambassadors.get(deptId);

    return {
      indicatorId: Number(row.indicator_id),
      departmentId: deptId,
      departmentName: String(row.department_name || ''),
      indicatorText: String(row.indicator_text || ''),
      outcomeLabel: String(row.outcome_label || ''),
      outcomeType: String(row.outcome_type || ''),
      strategicObjective: row.strategic_objective != null ? String(row.strategic_objective) : null,
      hodReviewStatus: hod,
      filled,
      total,
      progressStatus: progress,
      reportingCategory: reportingCategory(progress, hod),
      submittedAt: row.submitted_at != null ? String(row.submitted_at) : null,
      hodReviewedAt: row.hod_reviewed_at != null ? String(row.hod_reviewed_at) : null,
      ambassadorUserId: ambassador?.userId ?? null,
      ambassadorName: ambassador?.name ?? null,
      ambassadorEmail: ambassador?.email ?? null,
    };
  });
}

function rollupDepartments(assignments: AssignmentRow[]): DepartmentRollup[] {
  const deptMap = new Map<number, DepartmentRollup>();
  for (const a of assignments) {
    let d = deptMap.get(a.departmentId);
    if (!d) {
      d = {
        departmentId: a.departmentId,
        departmentName: a.departmentName,
        ambassadorName: a.ambassadorName,
        ambassadorEmail: a.ambassadorEmail,
        assignments: 0,
        notStarted: 0,
        inProgress: 0,
        completeDraft: 0,
        awaitingReview: 0,
        approved: 0,
        needsRevision: 0,
        fillRatePct: 0,
        approvalRatePct: 0,
      };
      deptMap.set(a.departmentId, d);
    }
    d.assignments += 1;
    if (a.progressStatus === 'not-started') d.notStarted += 1;
    else if (a.progressStatus === 'partial') d.inProgress += 1;
    else if (a.hodReviewStatus === 'draft' || a.hodReviewStatus === 'returned') d.completeDraft += 1;
    if (a.reportingCategory === 'awaiting-review') d.awaitingReview += 1;
    else if (a.reportingCategory === 'completed') d.approved += 1;
    else if (a.reportingCategory === 'needs-revision') d.needsRevision += 1;
  }

  return [...deptMap.values()].map((d) => {
    const deptAssignments = assignments.filter((a) => a.departmentId === d.departmentId);
    const filled = deptAssignments.reduce((s, a) => s + a.filled, 0);
    const total = deptAssignments.reduce((s, a) => s + a.total, 0);
    return {
      ...d,
      fillRatePct: total > 0 ? Math.round((filled / total) * 100) : 0,
      approvalRatePct: d.assignments > 0 ? Math.round((d.approved / d.assignments) * 100) : 0,
    };
  }).sort((a, b) => {
    const activity = (d: typeof a) =>
      (d.fillRatePct > 0 ? 1 : 0)
      + (d.approved > 0 ? 1 : 0)
      + (d.inProgress > 0 ? 1 : 0)
      + (d.awaitingReview > 0 ? 1 : 0)
      + (d.completeDraft > 0 ? 1 : 0);
    const actDiff = activity(b) - activity(a);
    if (actDiff !== 0) return actDiff;
    if (b.fillRatePct !== a.fillRatePct) return b.fillRatePct - a.fillRatePct;
    if (b.approved !== a.approved) return b.approved - a.approved;
    return a.departmentName.localeCompare(b.departmentName);
  });
}

function rollupObjectives(assignments: AssignmentRow[]): ObjectiveRollup[] {
  const objMap = new Map<string, ObjectiveRollup>();
  for (const a of assignments) {
    const key = a.strategicObjective || '__unassigned__';
    let o = objMap.get(key);
    if (!o) {
      o = {
        objective: a.strategicObjective || 'Unassigned objective',
        objectiveShort: coreObjectiveShortTitle(a.strategicObjective),
        assignments: 0,
        notStarted: 0,
        inProgress: 0,
        awaitingReview: 0,
        approved: 0,
        needsRevision: 0,
        fillRatePct: 0,
        approvalRatePct: 0,
      };
      objMap.set(key, o);
    }
    o.assignments += 1;
    if (a.progressStatus === 'not-started') o.notStarted += 1;
    else if (a.progressStatus === 'partial') o.inProgress += 1;
    if (a.reportingCategory === 'awaiting-review') o.awaitingReview += 1;
    else if (a.reportingCategory === 'completed') o.approved += 1;
    else if (a.reportingCategory === 'needs-revision') o.needsRevision += 1;
  }

  return [...objMap.values()].map((o) => {
    const objAssignments = assignments.filter(
      (a) => (a.strategicObjective || 'Unassigned objective') === o.objective
        || (!a.strategicObjective && o.objective === 'Unassigned objective'),
    );
    const filled = objAssignments.reduce((s, a) => s + a.filled, 0);
    const total = objAssignments.reduce((s, a) => s + a.total, 0);
    return {
      ...o,
      fillRatePct: total > 0 ? Math.round((filled / total) * 100) : 0,
      approvalRatePct: o.assignments > 0 ? Math.round((o.approved / o.assignments) * 100) : 0,
    };
  });
}

function rollupOutcomes(assignments: AssignmentRow[]): OutcomeRollup[] {
  const map = new Map<string, OutcomeRollup>();
  for (const a of assignments) {
    const key = outcomeKey(a.outcomeType, a.outcomeLabel);
    let o = map.get(key);
    if (!o) {
      o = {
        outcomeKey: key,
        outcomeLabel: a.outcomeLabel,
        outcomeType: a.outcomeType,
        strategicObjective: a.strategicObjective,
        objectiveShort: coreObjectiveShortTitle(a.strategicObjective),
        assignments: 0,
        notStarted: 0,
        inProgress: 0,
        awaitingReview: 0,
        approved: 0,
        needsRevision: 0,
        fillRatePct: 0,
        approvalRatePct: 0,
      };
      map.set(key, o);
    }
    o.assignments += 1;
    if (a.progressStatus === 'not-started') o.notStarted += 1;
    else if (a.progressStatus === 'partial') o.inProgress += 1;
    if (a.reportingCategory === 'awaiting-review') o.awaitingReview += 1;
    else if (a.reportingCategory === 'completed') o.approved += 1;
    else if (a.reportingCategory === 'needs-revision') o.needsRevision += 1;
  }

  return [...map.values()].map((o) => {
    const rows = assignments.filter((a) => outcomeKey(a.outcomeType, a.outcomeLabel) === o.outcomeKey);
    const filled = rows.reduce((s, a) => s + a.filled, 0);
    const total = rows.reduce((s, a) => s + a.total, 0);
    return {
      ...o,
      fillRatePct: total > 0 ? Math.round((filled / total) * 100) : 0,
      approvalRatePct: o.assignments > 0 ? Math.round((o.approved / o.assignments) * 100) : 0,
    };
  }).sort((a, b) => a.outcomeLabel.localeCompare(b.outcomeLabel));
}

function buildAgingQueue(assignments: AssignmentRow[]): AgingRow[] {
  return assignments
    .filter((a) => a.hodReviewStatus === 'submitted' && a.submittedAt)
    .map((a) => ({
      indicatorId: a.indicatorId,
      departmentId: a.departmentId,
      departmentName: a.departmentName,
      indicatorText: a.indicatorText,
      outcomeLabel: `${a.outcomeType}: ${a.outcomeLabel}`,
      ambassadorName: a.ambassadorName,
      submittedAt: a.submittedAt!,
      daysPending: daysSince(a.submittedAt!),
    }))
    .sort((a, b) => b.daysPending - a.daysPending);
}

function computeTotals(assignments: AssignmentRow[], agingQueue: AgingRow[]) {
  const totals = {
    assignments: assignments.length,
    notStarted: 0,
    inProgress: 0,
    completeDraft: 0,
    awaitingReview: 0,
    approved: 0,
    needsRevision: 0,
    fillRatePct: 0,
    approvalRatePct: 0,
    hodPendingCount: 0,
    avgHodPendingDays: 0,
  };

  let filledCells = 0;
  let totalCells = 0;

  for (const a of assignments) {
    totalCells += a.total;
    filledCells += a.filled;
    if (a.progressStatus === 'not-started') totals.notStarted += 1;
    else if (a.progressStatus === 'partial') totals.inProgress += 1;
    else if (a.hodReviewStatus === 'draft' || a.hodReviewStatus === 'returned') totals.completeDraft += 1;

    if (a.reportingCategory === 'awaiting-review') {
      totals.awaitingReview += 1;
      totals.hodPendingCount += 1;
    } else if (a.reportingCategory === 'completed') totals.approved += 1;
    else if (a.reportingCategory === 'needs-revision') totals.needsRevision += 1;
  }

  totals.fillRatePct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  totals.approvalRatePct = totals.assignments > 0
    ? Math.round((totals.approved / totals.assignments) * 100)
    : 0;
  totals.avgHodPendingDays = agingQueue.length > 0
    ? Math.round(agingQueue.reduce((s, r) => s + r.daysPending, 0) / agingQueue.length)
    : 0;

  return totals;
}

export async function buildAmbassadorReportsFromAssignments(
  assignments: AssignmentRow[],
): Promise<Omit<AmbassadorReportsSummary, 'generatedAt'>> {
  const agingQueue = buildAgingQueue(assignments);
  const byDepartment = rollupDepartments(assignments);
  const totals = computeTotals(assignments, agingQueue);

  return {
    totals,
    assignments,
    byDepartment,
    byObjective: rollupObjectives(assignments),
    byOutcome: rollupOutcomes(assignments),
    hodByDepartment: byDepartment.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
      pendingReview: d.awaitingReview,
      approved: d.approved,
      returned: d.needsRevision,
      draft: d.notStarted + d.inProgress + d.completeDraft,
      approvalRatePct: d.approvalRatePct,
    })),
    agingQueue,
  };
}

export async function getAmbassadorReportsSummary(): Promise<AmbassadorReportsSummary> {
  await ensureHodReviewWorkflowSchema();
  const ambassadors = await loadAmbassadorsByUnit();
  const rawRows = await loadRawAssignmentRows();
  const assignments = mapRawRowsToAssignments(rawRows, ambassadors);
  const body = await buildAmbassadorReportsFromAssignments(assignments);

  return {
    generatedAt: new Date().toISOString(),
    ...body,
  };
}

export async function getDepartmentAssignmentRows(departmentId: number): Promise<AssignmentRow[]> {
  await ensureHodReviewWorkflowSchema();
  const ambassadors = await loadAmbassadorsByUnit();
  const rawRows = await loadRawAssignmentRows(departmentId);
  return mapRawRowsToAssignments(rawRows, ambassadors);
}
