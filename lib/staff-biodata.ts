/**
 * Staff biodata constants and helpers (Phase 1 HR fields on users table).
 */

export const GENDER_OPTIONS = ['Male', 'Female'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const EMPLOYMENT_STATUSES = [
  'active',
  'on_leave',
  'expired',
  'terminated',
  'retired',
  'resigned',
  'dismissed',
  'deceased',
  'study_leave',
  'sabbatical',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const LEAVE_STATUSES = [
  'On Duty',
  'On Leave',
  'Sick Leave',
  'Annual Leave',
  'Study Leave',
  'Sabbatical Leave',
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  expired: 'Contract expired',
  terminated: 'Terminated',
  retired: 'Retired',
  resigned: 'Resigned',
  dismissed: 'Dismissed',
  deceased: 'Deceased',
  study_leave: 'On study leave',
  sabbatical: 'On sabbatical',
};

export function isGender(value: string | null | undefined): value is Gender {
  return !!value && (GENDER_OPTIONS as readonly string[]).includes(value);
}

export function isEmploymentStatus(value: string | null | undefined): value is EmploymentStatus {
  return !!value && (EMPLOYMENT_STATUSES as readonly string[]).includes(value);
}

export function isLeaveStatus(value: string | null | undefined): value is LeaveStatus {
  return !!value && (LEAVE_STATUSES as readonly string[]).includes(value);
}

export function formatEmploymentStatus(value: string | null | undefined): string {
  if (!value) return '—';
  if (isEmploymentStatus(value)) return EMPLOYMENT_STATUS_LABELS[value];
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Years elapsed since a date (one decimal place). */
export function yearsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const start = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.round((diffMs / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;
}

export function formatYears(value: number | null | undefined): string {
  if (value == null) return '—';
  return value === 1 ? '1 year' : `${value} years`;
}

export type StaffBiodataFields = {
  gender?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  date_first_appointment?: string | null;
  date_current_appointment?: string | null;
  date_office_assignment?: string | null;
  retirement_date?: string | null;
  designation_grade?: string | null;
  employment_status?: string | null;
  leave_status?: string | null;
};

export function normalizeOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  return s || null;
}

export function normalizeOptionalString(value: unknown, maxLen = 150): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

/** Persons with disabilities (Phase 2B) */
export const DISABILITY_STATUS_OPTIONS = ['Yes', 'No', 'Prefer not to say'] as const;
export type DisabilityStatus = (typeof DISABILITY_STATUS_OPTIONS)[number];

export const DISABILITY_TYPE_OPTIONS = [
  'Visual impairment',
  'Hearing impairment',
  'Mobility / physical impairment',
  'Intellectual / cognitive',
  'Psychosocial / mental health',
  'Speech impairment',
  'Multiple disabilities',
  'Other',
  'Prefer not to specify',
] as const;
export type DisabilityType = (typeof DISABILITY_TYPE_OPTIONS)[number];

export function isDisabilityStatus(value: string | null | undefined): value is DisabilityStatus {
  return !!value && (DISABILITY_STATUS_OPTIONS as readonly string[]).includes(value);
}

export function isDisabilityType(value: string | null | undefined): value is DisabilityType {
  return !!value && (DISABILITY_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function normalizeDisabilityPayload(body: {
  disability_status?: unknown;
  disability_type?: unknown;
  workplace_accommodation?: unknown;
  special_support_needs?: unknown;
}): {
  disability_status: DisabilityStatus | null;
  disability_type: string | null;
  workplace_accommodation: string | null;
  special_support_needs: string | null;
  error?: string;
} {
  const statusRaw =
    body.disability_status !== undefined && body.disability_status !== null
      ? String(body.disability_status).trim()
      : '';
  let disability_status: DisabilityStatus | null = null;
  if (statusRaw !== '') {
    if (!isDisabilityStatus(statusRaw)) {
      return {
        disability_status: null,
        disability_type: null,
        workplace_accommodation: null,
        special_support_needs: null,
        error: 'Invalid disability status.',
      };
    }
    disability_status = statusRaw;
  }

  if (disability_status === 'No' || disability_status === 'Prefer not to say') {
    return {
      disability_status,
      disability_type: null,
      workplace_accommodation: null,
      special_support_needs: null,
    };
  }

  const typeRaw =
    body.disability_type !== undefined && body.disability_type !== null
      ? String(body.disability_type).trim()
      : '';
  const disability_type = typeRaw === '' ? null : typeRaw;

  return {
    disability_status,
    disability_type,
    workplace_accommodation: normalizeOptionalString(body.workplace_accommodation, 2000),
    special_support_needs: normalizeOptionalString(body.special_support_needs, 2000),
  };
}

export type StaffProfileData = {
  id?: number;
  full_name: string;
  email: string;
  position?: string | null;
  leave_status?: string | null;
  account_status?: string | null;
  employment_status?: string | null;
  contract_type?: string | null;
  staff_category?: string | null;
  gender?: string | null;
  nationality?: string | null;
  designation_grade?: string | null;
  date_of_birth?: string | null;
  date_first_appointment?: string | null;
  date_current_appointment?: string | null;
  date_office_assignment?: string | null;
  retirement_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  active_tasks?: number;
  disability_status?: string | null;
  disability_type?: string | null;
  workplace_accommodation?: string | null;
  special_support_needs?: string | null;
  sections?: Array<{ id: number; name: string }>;
  department?: string | null;
  faculty_office?: string | null;
};

export function formatDisplayDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatSectionNames(staff: { sections?: Array<{ name: string }> }): string {
  const list = Array.isArray(staff.sections)
    ? staff.sections.map((s) => (s?.name || '').trim()).filter(Boolean)
    : [];
  return list.length ? list.join(', ') : 'Unassigned';
}

export type StaffProfileViewMode = 'hod' | 'admin' | 'ambassador';

export function formatDesignationPosition(staff: StaffProfileData): string {
  const parts = [staff.position?.trim(), staff.designation_grade?.trim()].filter(Boolean) as string[];
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(' · ') : '—';
}

/** Non-sensitive staff profile fields for modal display (admin, ambassador, HOD). */
export function buildStaffProfileRows(
  staff: StaffProfileData,
  mode: StaffProfileViewMode = 'admin'
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  const facultyOffice = staff.faculty_office?.trim();
  if (facultyOffice) {
    rows.push({ label: 'Office / faculty', value: facultyOffice });
  }

  rows.push(
    { label: 'Department / unit', value: staff.department || '—' },
    { label: 'Gender', value: staff.gender || '—' },
    { label: 'Designation / position', value: formatDesignationPosition(staff) },
    { label: 'Staff category', value: staff.staff_category || '—' }
  );

  if (mode === 'hod') {
    rows.push(
      { label: 'Sections', value: formatSectionNames(staff) },
      { label: 'Open assignments', value: String(staff.active_tasks ?? 0) }
    );
  }

  return rows;
}
