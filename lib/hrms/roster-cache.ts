import { hrmsTryListAllStaff } from './client';
import type { HrmsStaffRecord } from './types';

const ROSTER_TTL_MS = 15 * 60 * 1000;

let cache: { fetchedAt: number; rows: HrmsStaffRecord[] } | null = null;

export function clearHrmsRosterCache(): void {
  cache = null;
}

/** Load full HR staff roster once (cached briefly for batched import). */
export async function getHrmsRoster(forceRefresh = false): Promise<HrmsStaffRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < ROSTER_TTL_MS) {
    return cache.rows;
  }
  const rows = await hrmsTryListAllStaff();
  cache = { fetchedAt: now, rows };
  return rows;
}
