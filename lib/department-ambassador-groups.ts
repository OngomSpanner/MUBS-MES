export type AmbassadorDepartmentGroup = 'outreach' | 'regional' | 'faculty' | 'department_of';

export const AMBASSADOR_GROUP_ORDER: AmbassadorDepartmentGroup[] = [
  'outreach',
  'regional',
  'faculty',
  'department_of',
];

export const AMBASSADOR_GROUP_LABELS: Record<AmbassadorDepartmentGroup, string> = {
  outreach: 'All Outreach Centres',
  regional: 'All Regional Campuses',
  faculty: 'All Faculties',
  department_of: 'All Departments',
};

/** Short labels for compact badge chips. */
export const AMBASSADOR_GROUP_BADGE_LABELS: Record<AmbassadorDepartmentGroup, string> = {
  outreach: 'All Outreach Centre',
  regional: 'All Regional Campus',
  faculty: 'All Faculties',
  department_of: 'All Departments',
};

/** Tooltip text describing each group's matching rule. */
export const AMBASSADOR_GROUP_TITLES: Record<AmbassadorDepartmentGroup, string> = {
  outreach: 'Registered outreach centres from the system allowlist (by department id / name)',
  regional: 'Registered regional campuses from the system allowlist (by department id / name)',
  faculty: 'Registered units whose system name starts with Faculty of',
  department_of: 'Registered units whose system name starts with Department of',
};

/** Registered outreach centre names in departments.name (exact allowlist). */
export const OUTREACH_CENTRE_NAMES = [
  'DISABILITY AND RESOURCE LEARNING CENTRE',
  'ENTREPRENEURSHIP, INNOVATION AND INCUBATION CENTRE',
  'KNOWLEDGE FOR DEVELOPMENT CENTRE',
  'ECONOMIC FORUM',
  'LEADERSHIP CENTER',
  'CAREER AND SKILLS DEVELOPMENT CENTRE',
  'ICT CENTRE',
] as const;

/** Registered regional campus names in departments.name (exact allowlist). */
export const REGIONAL_CAMPUS_NAMES = [
  'MUBS REGIONAL CAMPUS-ARUA',
  'MUBS REGIONAL CAMPUS MBARARA',
  'MUBS REGIONAL CAMPUS-JINJA',
  'MUBS REGIONAL CAMPUS-MBALE',
] as const;

export type AmbassadorGroupIdSets = {
  outreach: ReadonlySet<number>;
  regional: ReadonlySet<number>;
};

export function normalizeDepartmentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAllowlistName(name: string): string {
  return normalizeDepartmentName(name).replace(/\bcentre\b/g, 'center');
}

/** Strict allowlist match on registered departments.name (centre/center equivalent). */
function matchesStrictAllowlist(registeredName: string, allowlist: readonly string[]): boolean {
  const normalized = normalizeAllowlistName(registeredName);
  return allowlist.some((entry) => normalizeAllowlistName(entry) === normalized);
}

export function isOutreachCentre(registeredName: string): boolean {
  return matchesStrictAllowlist(registeredName, OUTREACH_CENTRE_NAMES);
}

export function isRegionalCampus(registeredName: string): boolean {
  return matchesStrictAllowlist(registeredName, REGIONAL_CAMPUS_NAMES);
}

export function isFacultyDepartment(registeredName: string): boolean {
  return normalizeDepartmentName(registeredName).startsWith('faculty of');
}

export function isDepartmentOfUnit(registeredName: string): boolean {
  return normalizeDepartmentName(registeredName).startsWith('department of');
}

/**
 * Classify a registered department record.
 * Outreach/regional use id sets resolved from departments.name; faculty/dept use registered name only.
 */
export function classifyAmbassadorDepartmentGroupForRecord(
  record: { id: number; registeredName: string },
  idSets: AmbassadorGroupIdSets,
): AmbassadorDepartmentGroup | null {
  if (idSets.outreach.has(record.id)) return 'outreach';
  if (idSets.regional.has(record.id)) return 'regional';
  if (isFacultyDepartment(record.registeredName)) return 'faculty';
  if (isDepartmentOfUnit(record.registeredName)) return 'department_of';
  return null;
}

/** @deprecated Prefer classifyAmbassadorDepartmentGroupForRecord with id sets. */
export function classifyAmbassadorDepartmentGroup(registeredName: string): AmbassadorDepartmentGroup | null {
  if (isFacultyDepartment(registeredName)) return 'faculty';
  if (isDepartmentOfUnit(registeredName)) return 'department_of';
  if (isRegionalCampus(registeredName)) return 'regional';
  if (isOutreachCentre(registeredName)) return 'outreach';
  return null;
}

export type AmbassadorDepartmentRow = {
  id: number;
  /** Display label (external_name when set, else registered name). */
  name: string;
  /** Canonical departments.name used for grouping. */
  registered_name: string;
  parent_id: number | null;
  unit_type: string;
  ambassador_group: AmbassadorDepartmentGroup | null;
};

export function attachAmbassadorGroup(
  row: Omit<AmbassadorDepartmentRow, 'ambassador_group'>,
  idSets: AmbassadorGroupIdSets,
): AmbassadorDepartmentRow {
  return {
    ...row,
    ambassador_group: classifyAmbassadorDepartmentGroupForRecord(
      { id: row.id, registeredName: row.registered_name },
      idSets,
    ),
  };
}

export function filterDepartmentsByGroup<T extends { ambassador_group?: AmbassadorDepartmentGroup | null }>(
  departments: T[],
  group: AmbassadorDepartmentGroup,
): T[] {
  return departments.filter((d) => d.ambassador_group === group);
}

export function createAmbassadorGroupCounts(): Record<AmbassadorDepartmentGroup, number> {
  return {
    outreach: 0,
    regional: 0,
    faculty: 0,
    department_of: 0,
  };
}

export function countAmbassadorDepartmentsByGroup(
  departments: { ambassador_group?: AmbassadorDepartmentGroup | null }[],
): Record<AmbassadorDepartmentGroup, number> {
  const counts = createAmbassadorGroupCounts();
  for (const d of departments) {
    if (d.ambassador_group) counts[d.ambassador_group] += 1;
  }
  return counts;
}
