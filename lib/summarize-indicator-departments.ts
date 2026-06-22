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
  | { kind: 'group'; group: AmbassadorDepartmentGroup; label: string }
  | { kind: 'unit'; id: number; name: string };

/**
 * Collapse full ambassador group selections into summary labels (no counts).
 * Remaining units are returned individually by name.
 */
export function summarizeIndicatorDepartments(
  selected: IndicatorDeptRef[],
  catalog: GroupCatalogEntry[],
): IndicatorDepartmentBadge[] {
  if (selected.length === 0) return [];

  const selectedIds = new Set(selected.map((d) => d.id));
  const remaining = new Map(selected.map((d) => [d.id, d.name]));
  const badges: IndicatorDepartmentBadge[] = [];

  for (const group of AMBASSADOR_GROUP_ORDER) {
    const groupIds = catalog
      .filter((c) => c.ambassador_group === group)
      .map((c) => c.id);
    if (groupIds.length === 0) continue;
    if (groupIds.every((id) => selectedIds.has(id))) {
      badges.push({
        kind: 'group',
        group,
        label: AMBASSADOR_GROUP_BADGE_LABELS[group],
      });
      for (const id of groupIds) remaining.delete(id);
    }
  }

  const individuals = Array.from(remaining.entries())
    .map(([id, name]) => ({ kind: 'unit' as const, id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...badges, ...individuals];
}
