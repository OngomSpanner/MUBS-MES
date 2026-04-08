/** HOD process reassignment — fixed reason codes (labels shown in UI; codes stored in audit trail). */
export const PROCESS_REASSIGN_REASONS = [
    { code: 'did_not_perform', label: 'Did not perform' },
    { code: 'leave_absence', label: 'Leave / absence' },
    { code: 'workload_restructuring', label: 'Workload / restructuring' },
    { code: 'skill_fit', label: 'Skills / role fit' },
    { code: 'staff_request', label: 'At staff request' },
    { code: 'other', label: 'Other' },
] as const;

export type ProcessReassignReasonCode = (typeof PROCESS_REASSIGN_REASONS)[number]['code'];

const CODE_SET = new Set<string>(PROCESS_REASSIGN_REASONS.map((r) => r.code));

export function isValidReassignReasonCode(code: string): code is ProcessReassignReasonCode {
    return CODE_SET.has(code);
}

export function reassignReasonLabel(code: string): string | null {
    const row = PROCESS_REASSIGN_REASONS.find((r) => r.code === code);
    return row ? row.label : null;
}
