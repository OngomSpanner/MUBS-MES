import {
  AMBASSADOR_GROUP_ORDER,
  type AmbassadorDepartmentGroup,
} from '@/lib/department-ambassador-groups';

export type AmbassadorGroupCatalogEntry = {
  id: number;
  ambassador_group?: AmbassadorDepartmentGroup | null;
};

function groupMemberIds(
  catalog: AmbassadorGroupCatalogEntry[],
  group: AmbassadorDepartmentGroup,
): number[] {
  return catalog.filter((c) => c.ambassador_group === group).map((c) => c.id);
}

/**
 * Expand selection only for groups the admin explicitly subscribed to
 * (e.g. clicked "All Regional Campus"). Picking a single centre/campus
 * no longer pulls in every peer unit.
 */
export function expandAmbassadorGroupSelection(
  selectedIds: Iterable<number>,
  catalog: AmbassadorGroupCatalogEntry[],
  subscribedGroups?: Iterable<AmbassadorDepartmentGroup>,
): number[] {
  const selected = new Set(selectedIds);
  const assigned = new Set(subscribedGroups ?? []);

  for (const group of AMBASSADOR_GROUP_ORDER) {
    if (!assigned.has(group)) continue;
    for (const id of groupMemberIds(catalog, group)) {
      selected.add(id);
    }
  }

  return Array.from(selected);
}

/**
 * Groups that are fully selected (every ambassador unit in the group).
 * Used when the client does not send an explicit assigned_groups list.
 */
export function inferSubscribedAmbassadorGroups(
  selectedIds: Iterable<number>,
  catalog: AmbassadorGroupCatalogEntry[],
): AmbassadorDepartmentGroup[] {
  const selected = new Set(selectedIds);
  return AMBASSADOR_GROUP_ORDER.filter((group) => {
    const backed = groupMemberIds(catalog, group);
    return backed.length > 0 && backed.every((id) => selected.has(id));
  });
}
