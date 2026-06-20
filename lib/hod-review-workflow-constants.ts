/** Client-safe HOD review workflow constants (no database imports). */

export const HOD_REVIEW_STATUSES = ['draft', 'submitted', 'approved', 'returned'] as const;
export type HodReviewStatus = (typeof HOD_REVIEW_STATUSES)[number];

export const HOD_REVIEW_STATUS_LABELS: Record<HodReviewStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting HOD',
  approved: 'Approved',
  returned: 'Returned',
};

/** SQL fragment: only rows visible to admin after HOD approval (legacy rows without column pass through). */
export function sqlAdminApprovedOnly(alias: string): string {
  return `(${alias}.hod_review_status IS NULL OR ${alias}.hod_review_status = 'approved')`;
}

export function isHodReviewStatus(value: string): value is HodReviewStatus {
  return (HOD_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function parseSubmitForReview(body: {
  submitForReview?: boolean;
  submit_for_review?: boolean;
}): boolean {
  return Boolean(body.submitForReview ?? body.submit_for_review);
}

export function hodStatusForAmbassadorSave(submitForReview: boolean): HodReviewStatus {
  return submitForReview ? 'submitted' : 'draft';
}
