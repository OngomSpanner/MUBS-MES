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
 * When an indicator includes any ambassador unit from a group (e.g. 19 of 24 departments),
 * treat that as a full-group assignment and add every other member of that group.
 * New ambassador units in the group are included automatically on the next sync.
 */
export function expandAmbassadorGroupSelection(
  selectedIds: Iterable<number>,
  catalog: AmbassadorGroupCatalogEntry[],
  subscribedGroups?: Iterable<AmbassadorDepartmentGroup>,
): number[] {
  const selected = new Set(selectedIds);
  const assigned = new Set(subscribedGroups ?? []);

  let loop = true;
  while (loop) {
    loop = false;
    for (const group of AMBASSADOR_GROUP_ORDER) {
      const backed = groupMemberIds(catalog, group);
      if (backed.length === 0) continue;

      const hasAnyInGroup = backed.some((id) => selected.has(id));
      const subscribed = assigned.has(group) || hasAnyInGroup;
      if (!subscribed) continue;

      if (hasAnyInGroup) assigned.add(group);

      for (const id of backed) {
        if (!selected.has(id)) {
          selected.add(id);
          loop = true;
        }
      }
    }
  }

  return Array.from(selected);
}

/** Groups that should auto-complete when the catalog grows. */
export function inferSubscribedAmbassadorGroups(
  selectedIds: Iterable<number>,
  catalog: AmbassadorGroupCatalogEntry[],
): AmbassadorDepartmentGroup[] {
  const selected = new Set(selectedIds);
  return AMBASSADOR_GROUP_ORDER.filter((group) => {
    const backed = groupMemberIds(catalog, group);
    return backed.length > 0 && backed.some((id) => selected.has(id));
  });
}
