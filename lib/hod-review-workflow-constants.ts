/** Client-safe HOD review workflow constants (no database imports). */

/** User-facing label for the reviewing role (avoid bare "HOD" in UI copy). */
export const HOD_UNIT_HEAD_LABEL = 'Head of Department / Unit Head';

export const STRATEGY_ADMIN_LABEL = 'Strategy / Admin';

export const ADMIN_RETURN_TARGETS = ['ambassador', 'hod'] as const;
export type AdminReturnTarget = (typeof ADMIN_RETURN_TARGETS)[number];

export const HOD_REVIEW_STATUSES = ['draft', 'submitted', 'approved', 'returned'] as const;
export type HodReviewStatus = (typeof HOD_REVIEW_STATUSES)[number];

export const HOD_REVIEW_STATUS_LABELS: Record<HodReviewStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  approved: 'Approved',
  returned: 'Revision requested',
};

/** SQL fragment: only rows visible to admin after HOD approval (legacy rows without column pass through). */
export function sqlAdminApprovedOnly(alias: string): string {
  return `(${alias}.hod_review_status IS NULL OR ${alias}.hod_review_status = 'approved')`;
}

export const HOD_PERFORMANCE_RATINGS = ['under', 'on_target', 'over'] as const;
export type HodPerformanceRating = (typeof HOD_PERFORMANCE_RATINGS)[number];

export const HOD_PERFORMANCE_RATING_LABELS: Record<HodPerformanceRating, string> = {
  under: 'Under target',
  on_target: 'On target',
  over: 'Over target',
};

export function parseHodPerformanceRating(raw: unknown): HodPerformanceRating | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (HOD_PERFORMANCE_RATINGS as readonly string[]).includes(s) ? (s as HodPerformanceRating) : null;
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
