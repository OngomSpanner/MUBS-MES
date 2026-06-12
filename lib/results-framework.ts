export const PERFORMANCE_STATUSES = ['underperformance', 'achievement', 'overachievement'] as const;
export type PerformanceStatus = (typeof PERFORMANCE_STATUSES)[number];

export const PRACTICE_TYPES = ['existing_practice', 'innovation'] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceStatus, string> = {
  underperformance: 'Underperformance',
  achievement: 'Achievement',
  overachievement: 'Overachievement',
};

export const PRACTICE_TYPE_LABELS: Record<PracticeType, string> = {
  existing_practice: 'Existing practice',
  innovation: 'New innovation',
};

/** Default bands: under 90% of target, 90–110% achievement, above 110% overachievement */
export function computePerformanceStatus(
  target: number | null | undefined,
  actual: number | null | undefined
): PerformanceStatus | null {
  if (target == null || actual == null || Number.isNaN(target) || Number.isNaN(actual)) {
    return null;
  }
  if (target <= 0) {
    if (actual <= 0) return 'achievement';
    return 'overachievement';
  }
  const ratio = actual / target;
  if (ratio < 0.9) return 'underperformance';
  if (ratio > 1.1) return 'overachievement';
  return 'achievement';
}

export function isPerformanceStatus(value: string): value is PerformanceStatus {
  return (PERFORMANCE_STATUSES as readonly string[]).includes(value);
}

export function isPracticeType(value: string): value is PracticeType {
  return (PRACTICE_TYPES as readonly string[]).includes(value);
}

export function performanceStatusBadgeStyle(status: PerformanceStatus | null | undefined): {
  bg: string;
  color: string;
} {
  switch (status) {
    case 'underperformance':
      return { bg: '#fee2e2', color: '#b91c1c' };
    case 'achievement':
      return { bg: '#dcfce7', color: '#15803d' };
    case 'overachievement':
      return { bg: '#dbeafe', color: '#1d4ed8' };
    default:
      return { bg: '#f1f5f9', color: '#475569' };
  }
}
