export type WorkloadStatus =
  | 'over_allocated'
  | 'underutilized'
  | 'on_track'
  | 'falling_behind';

export const WORKLOAD_STATUS_LABELS: Record<WorkloadStatus, string> = {
  over_allocated: 'Over-allocated',
  underutilized: 'Underutilized',
  on_track: 'On track',
  falling_behind: 'Falling behind',
};

export function workloadStatusStyle(status: WorkloadStatus): { bg: string; color: string } {
  switch (status) {
    case 'over_allocated':
      return { bg: '#fee2e2', color: '#b91c1c' };
    case 'underutilized':
      return { bg: '#f1f5f9', color: '#475569' };
    case 'falling_behind':
      return { bg: '#fef3c7', color: '#b45309' };
    default:
      return { bg: '#dcfce7', color: '#15803d' };
  }
}

export function computeWorkloadStatus(
  activeTasks: number,
  overdueIncomplete: number
): WorkloadStatus {
  if (overdueIncomplete > 0) return 'falling_behind';
  if (activeTasks === 0) return 'underutilized';
  if (activeTasks > 5) return 'over_allocated';
  return 'on_track';
}
