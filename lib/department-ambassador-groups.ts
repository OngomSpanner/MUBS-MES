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

/** Tooltip text describing each group's name-matching rule. */
export const AMBASSADOR_GROUP_TITLES: Record<AmbassadorDepartmentGroup, string> = {
  outreach: 'Listed outreach centres only (not every unit ending in Centre)',
  regional: 'Listed regional campuses only',
  faculty: 'Units whose name starts with Faculty of',
  department_of: 'Units whose name starts with Department of',
};

/** Canonical outreach centre names — exact allowlist only (not every unit ending in Centre). */
export const OUTREACH_CENTRE_NAMES = [
  'DISABILITY AND RESOURCE LEARNING CENTRE',
  'ENTREPRENEURSHIP, INNOVATION AND INCUBATION CENTRE',
  'KNOWLEDGE FOR DEVELOPMENT CENTRE',
  'ECONOMIC FORUM',
  'LEADERSHIP CENTER',
  'CAREER AND SKILLS DEVELOPMENT CENTRE',
  'ICT CENTRE',
] as const;

/** Canonical regional campus names — exact allowlist only. */
export const REGIONAL_CAMPUS_NAMES = [
  'MUBS REGIONAL CAMPUS-ARUA',
  'MUBS REGIONAL CAMPUS MBARARA',
  'MUBS REGIONAL CAMPUS-JINJA',
  'MUBS REGIONAL CAMPUS-MBALE',
] as const;

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

/** Strict allowlist match: normalized equality only (centre/center equivalent). */
function matchesStrictAllowlist(name: string, allowlist: readonly string[]): boolean {
  const normalized = normalizeAllowlistName(name);
  return allowlist.some((entry) => normalizeAllowlistName(entry) === normalized);
}

export function isOutreachCentre(name: string): boolean {
  return matchesStrictAllowlist(name, OUTREACH_CENTRE_NAMES);
}

export function isRegionalCampus(name: string): boolean {
  return matchesStrictAllowlist(name, REGIONAL_CAMPUS_NAMES);
}

export function isFacultyDepartment(name: string): boolean {
  return normalizeDepartmentName(name).startsWith('faculty of');
}

export function isDepartmentOfUnit(name: string): boolean {
  return normalizeDepartmentName(name).startsWith('department of');
}

export function classifyAmbassadorDepartmentGroup(name: string): AmbassadorDepartmentGroup | null {
  if (isFacultyDepartment(name)) return 'faculty';
  if (isDepartmentOfUnit(name)) return 'department_of';
  if (isRegionalCampus(name)) return 'regional';
  if (isOutreachCentre(name)) return 'outreach';
  return null;
}

export function departmentMatchesGroup(name: string, group: AmbassadorDepartmentGroup): boolean {
  return classifyAmbassadorDepartmentGroup(name) === group;
}

export type AmbassadorDepartmentRow = {
  id: number;
  name: string;
  parent_id: number | null;
  unit_type: string;
  ambassador_group: AmbassadorDepartmentGroup | null;
};

export function withAmbassadorGroup<T extends { name: string }>(
  row: T,
): T & { ambassador_group: AmbassadorDepartmentGroup | null } {
  return {
    ...row,
    ambassador_group: classifyAmbassadorDepartmentGroup(row.name),
  };
}

export function filterDepartmentsByGroup<T extends { name: string }>(
  departments: T[],
  group: AmbassadorDepartmentGroup,
): T[] {
  return departments.filter((d) => departmentMatchesGroup(d.name, group));
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
