export const CHANGE_REQUEST_CATEGORIES = [
  { value: 'unit_structure', label: 'Unit / department structure' },
  { value: 'indicators', label: 'Indicators & targets' },
  { value: 'activity_templates', label: 'Activity templates & processes' },
  { value: 'other', label: 'Other' },
] as const;

export type ChangeRequestCategory = (typeof CHANGE_REQUEST_CATEGORIES)[number]['value'];

export const CHANGE_REQUEST_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'completed',
] as const;

export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];

export const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

export type AmbassadorChangeRequest = {
  id: number;
  userId: number;
  managedUnitId: number | null;
  category: ChangeRequestCategory;
  title: string;
  description: string;
  status: ChangeRequestStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminChangeRequest = AmbassadorChangeRequest & {
  ambassadorName: string;
  ambassadorEmail: string;
  managedUnitName: string;
};

export function isChangeRequestCategory(value: string): value is ChangeRequestCategory {
  return CHANGE_REQUEST_CATEGORIES.some((c) => c.value === value);
}

export function isChangeRequestStatus(value: string): value is ChangeRequestStatus {
  return (CHANGE_REQUEST_STATUSES as readonly string[]).includes(value);
}
