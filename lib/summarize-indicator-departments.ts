import {
  AMBASSADOR_GROUP_BADGE_LABELS,
  AMBASSADOR_GROUP_ORDER,
  type AmbassadorDepartmentGroup,
} from '@/lib/department-ambassador-groups';

export type IndicatorDeptRef = { id: number; name: string };

export type GroupCatalogEntry = {
  id: number;
  ambassador_group?: AmbassadorDepartmentGroup | null;
};

export type IndicatorDepartmentBadge =
  | { kind: 'group'; group: AmbassadorDepartmentGroup; label: string; complete: boolean }
  | { kind: 'unit'; id: number; name: string };

/**
 * Collapse ambassador group selections into summary labels.
 * Full group → "All Faculties (12)". Partial → "All Faculties (10/12)" so the list
 * stays compact when the catalog grows after the indicator was saved.
 * Unclassified or lone units are returned individually by name.
 */
export function summarizeIndicatorDepartments(
  selected: IndicatorDeptRef[],
  catalog: GroupCatalogEntry[],
): IndicatorDepartmentBadge[] {
  if (selected.length === 0) return [];

  const remaining = new Map(selected.map((d) => [d.id, d.name]));
  const badges: IndicatorDepartmentBadge[] = [];

  for (const group of AMBASSADOR_GROUP_ORDER) {
    const groupIds = catalog
      .filter((c) => c.ambassador_group === group)
      .map((c) => c.id);
    if (groupIds.length === 0) continue;

    const selectedInGroup = groupIds.filter((id) => remaining.has(id));
    if (selectedInGroup.length === 0) continue;

    const baseLabel = AMBASSADOR_GROUP_BADGE_LABELS[group];
    const complete = selectedInGroup.length === groupIds.length;
    const label = complete
      ? `${baseLabel} (${groupIds.length})`
      : `${baseLabel} (${selectedInGroup.length}/${groupIds.length})`;

    badges.push({ kind: 'group', group, label, complete });
    for (const id of selectedInGroup) remaining.delete(id);
  }

  const individuals = Array.from(remaining.entries())
    .map(([id, name]) => ({ kind: 'unit' as const, id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...badges, ...individuals];
}
