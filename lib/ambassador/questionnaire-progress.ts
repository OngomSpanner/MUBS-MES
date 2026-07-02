import {
  buildAmbassadorReportsFromAssignments,
  getDepartmentAssignmentRows,
  type AssignmentRow,
} from '@/lib/admin/ambassador-reports-aggregate';

export type AmbassadorInsight = {
  type: 'action' | 'info' | 'success';
  icon: string;
  title: string;
  detail: string;
  href?: string;
};

export type AmbassadorQuestionnaireProgress = {
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
  };
  byOutcome: Awaited<ReturnType<typeof buildAmbassadorReportsFromAssignments>>['byOutcome'];
  priorityAssignments: AssignmentRow[];
  insights: AmbassadorInsight[];
};

function buildInsights(assignments: AssignmentRow[], totals: AmbassadorQuestionnaireProgress['totals']): AmbassadorInsight[] {
  const insights: AmbassadorInsight[] = [];

  if (totals.notStarted > 0) {
    insights.push({
      type: 'action',
      icon: 'play_circle',
      title: `${totals.notStarted} indicator${totals.notStarted === 1 ? '' : 's'} not started`,
      detail: 'Begin entering performance data for assigned indicators.',
      href: '/ambassador?pg=reporting&tab=data-collection',
    });
  }

  if (totals.inProgress > 0) {
    insights.push({
      type: 'action',
      icon: 'edit',
      title: `${totals.inProgress} in progress`,
      detail: 'Complete remaining metric cells and submit for HOD review.',
      href: '/ambassador?pg=reporting&tab=data-collection',
    });
  }

  if (totals.completeDraft > 0) {
    insights.push({
      type: 'action',
      icon: 'send',
      title: `${totals.completeDraft} ready to submit`,
      detail: 'Data entry is complete — submit to your Head of Department.',
      href: '/ambassador?pg=reporting&tab=data-collection',
    });
  }

  if (totals.needsRevision > 0) {
    insights.push({
      type: 'action',
      icon: 'undo',
      title: `${totals.needsRevision} returned for revision`,
      detail: 'Review HOD feedback, update values, and resubmit.',
      href: '/ambassador?pg=reporting&tab=data-collection',
    });
  }

  if (totals.awaitingReview > 0) {
    insights.push({
      type: 'info',
      icon: 'hourglass_top',
      title: `${totals.awaitingReview} awaiting HOD approval`,
      detail: 'Submitted indicators are in your Head of Department review queue.',
    });
  }

  if (totals.approved === totals.assignments && totals.assignments > 0) {
    insights.push({
      type: 'success',
      icon: 'verified',
      title: 'All indicators approved',
      detail: 'Your unit questionnaire reporting is fully approved for this cycle.',
    });
  }

  if (insights.length === 0 && totals.assignments === 0) {
    insights.push({
      type: 'info',
      icon: 'info',
      title: 'No indicators assigned yet',
      detail: 'When strategy administrators assign indicators to your unit, they will appear here.',
    });
  }

  return insights.slice(0, 5);
}

function priorityScore(a: AssignmentRow): number {
  if (a.reportingCategory === 'needs-revision') return 100;
  if (a.progressStatus === 'not-started') return 90;
  if (a.progressStatus === 'partial') return 80;
  if (a.progressStatus === 'complete' && (a.hodReviewStatus === 'draft' || a.hodReviewStatus === 'returned')) return 70;
  if (a.reportingCategory === 'awaiting-review') return 10;
  return 0;
}

export async function getAmbassadorQuestionnaireProgress(
  departmentId: number,
): Promise<AmbassadorQuestionnaireProgress> {
  const assignments = await getDepartmentAssignmentRows(departmentId);
  const body = await buildAmbassadorReportsFromAssignments(assignments);

  const priorityAssignments = [...assignments]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 8);

  return {
    totals: {
      assignments: body.totals.assignments,
      notStarted: body.totals.notStarted,
      inProgress: body.totals.inProgress,
      completeDraft: body.totals.completeDraft,
      awaitingReview: body.totals.awaitingReview,
      approved: body.totals.approved,
      needsRevision: body.totals.needsRevision,
      fillRatePct: body.totals.fillRatePct,
      approvalRatePct: body.totals.approvalRatePct,
    },
    byOutcome: body.byOutcome,
    priorityAssignments,
    insights: buildInsights(assignments, {
      assignments: body.totals.assignments,
      notStarted: body.totals.notStarted,
      inProgress: body.totals.inProgress,
      completeDraft: body.totals.completeDraft,
      awaitingReview: body.totals.awaitingReview,
      approved: body.totals.approved,
      needsRevision: body.totals.needsRevision,
      fillRatePct: body.totals.fillRatePct,
      approvalRatePct: body.totals.approvalRatePct,
    }),
  };
}
