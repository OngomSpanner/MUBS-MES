export type AmbassadorDepartmentGroup = 'outreach' | 'regional' | 'faculty';

export const AMBASSADOR_GROUP_LABELS: Record<AmbassadorDepartmentGroup, string> = {
  outreach: 'All Outreach Centres',
  regional: 'All Regional Campuses',
  faculty: 'All Faculties',
};

/** Canonical outreach centre names (matched with normalized fuzzy compare). */
export const OUTREACH_CENTRE_NAMES = [
  'DISABILITY AND RESOURCE LEARNING CENTRE',
  'ENTREPRENEURSHIP, INNOVATION AND INCUBATION CENTRE',
  'KNOWLEDGE FOR DEVELOPMENT CENTRE',
  'ECONOMIC FORUM',
  'LEADERSHIP CENTER',
  'CAREER AND SKILLS DEVELOPMENT CENTRE',
  'ICT CENTRE',
] as const;

/** Canonical regional campus names (matched with normalized fuzzy compare). */
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

function normalizedTokens(name: string): string[] {
  return normalizeDepartmentName(name).split(' ').filter(Boolean);
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeDepartmentName(a);
  const nb = normalizeDepartmentName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = normalizedTokens(a);
  const tb = normalizedTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  const shorter = ta.length <= tb.length ? ta : tb;
  const longer = ta.length <= tb.length ? tb : ta;
  return shorter.every((t) => longer.includes(t));
}

function matchesAllowlist(name: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) => namesMatch(name, entry));
}

export function isFacultyDepartment(name: string): boolean {
  return normalizeDepartmentName(name).startsWith('faculty of');
}

export function classifyAmbassadorDepartmentGroup(name: string): AmbassadorDepartmentGroup | null {
  if (isFacultyDepartment(name)) return 'faculty';
  if (matchesAllowlist(name, REGIONAL_CAMPUS_NAMES)) return 'regional';
  if (matchesAllowlist(name, OUTREACH_CENTRE_NAMES)) return 'outreach';
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
