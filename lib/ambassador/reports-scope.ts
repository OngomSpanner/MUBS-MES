import { query } from '@/lib/db';
import { normalizeRoleForCookie, parseRoles } from '@/lib/role-routing';
import { isHrManagedUnit } from '@/lib/ambassador/hr-unit';

export type AmbassadorReportScope = {
  /** Caller is limited to their managed unit (ambassador). */
  restricted: boolean;
  managedUnitId: number | null;
  isElevated: boolean;
};

async function getManagedUnitName(managedUnitId: number): Promise<string> {
  const rows = (await query({
    query: `SELECT COALESCE(NULLIF(TRIM(external_name), ''), name, '') AS unit_name FROM departments WHERE id = ?`,
    values: [managedUnitId],
  })) as { unit_name: string }[];
  return rows[0]?.unit_name ?? '';
}

/**
 * Staff HR reports: HR directorate ambassadors see institution-wide data (undefined).
 * Other ambassadors remain scoped to their managed unit.
 */
export async function resolveStaffReportManagedUnitId(
  ambassadorScope: AmbassadorReportScope
): Promise<number | undefined> {
  if (!ambassadorScope.restricted) return undefined;
  if (!ambassadorScope.managedUnitId) return undefined;

  const unitName = await getManagedUnitName(ambassadorScope.managedUnitId);
  if (await isHrManagedUnit(ambassadorScope.managedUnitId, unitName)) {
    return undefined;
  }
  return ambassadorScope.managedUnitId;
}

async function loadUserRoleSet(userId: number): Promise<Set<string>> {
  const roles = new Set<string>();

  const userRows = (await query({
    query: 'SELECT role FROM users WHERE id = ?',
    values: [userId],
  })) as { role: string | null }[];

  for (const r of parseRoles(userRows[0]?.role)) {
    roles.add(normalizeRoleForCookie(r).toLowerCase());
  }

  try {
    const roleRows = (await query({
      query: 'SELECT role FROM user_roles WHERE user_id = ?',
      values: [userId],
    })) as { role: string }[];
    for (const row of roleRows) {
      if (row.role) roles.add(normalizeRoleForCookie(row.role).toLowerCase());
    }
  } catch {
    // user_roles may not exist on older installs
  }

  return roles;
}

async function getCallerManagedUnitId(userId: number): Promise<number | null> {
  const rows = (await query({
    query: 'SELECT managed_unit_id FROM users WHERE id = ?',
    values: [userId],
  })) as { managed_unit_id: number | null }[];
  const id = rows[0]?.managed_unit_id;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

/**
 * Resolves managed-unit scope for ambassador-facing report types.
 * Ambassadors are always pinned to their assigned unit (client param ignored if forged).
 */
export async function resolveAmbassadorReportScope(
  userId: number,
  requestedManagedUnitId: number | null
): Promise<AmbassadorReportScope> {
  const roles = await loadUserRoleSet(userId);
  const isElevated =
    roles.has('system administrator') || roles.has('strategy manager');
  const isAmbassador = roles.has('ambassador');
  const callerUnitId = await getCallerManagedUnitId(userId);

  if (isElevated) {
    return {
      restricted: false,
      managedUnitId:
        requestedManagedUnitId && Number.isFinite(requestedManagedUnitId)
          ? requestedManagedUnitId
          : null,
      isElevated: true,
    };
  }

  if (isAmbassador && callerUnitId) {
    return {
      restricted: true,
      managedUnitId: callerUnitId,
      isElevated: false,
    };
  }

  if (requestedManagedUnitId) {
    return { restricted: true, managedUnitId: null, isElevated: false };
  }

  return { restricted: false, managedUnitId: null, isElevated: false };
}
