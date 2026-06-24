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
 * Expand selected ambassador units when a full group was subscribed and the catalog grew,
 * or when every other member of a group is already selected (new ambassador on one unit).
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

      if (assigned.has(group)) {
        for (const id of backed) {
          if (!selected.has(id)) {
            selected.add(id);
            loop = true;
          }
        }
        continue;
      }

      for (const missingId of backed) {
        if (selected.has(missingId)) continue;
        const others = backed.filter((id) => id !== missingId);
        if (others.length > 0 && others.every((id) => selected.has(id))) {
          selected.add(missingId);
          assigned.add(group);
          loop = true;
        }
      }
    }
  }

  return Array.from(selected);
}
