import { query } from '@/lib/db';
import { normalizeHrmsEmail } from './parse-date';
import { getHrmsRoster } from './roster-cache';
import { syncUserFromHrmsRecord } from './sync-user';
import type { HrmsStaffRecord, HrmsSyncResult } from './types';

export type ImportNewSummary = {
  totalInRoster: number;
  processed: number;
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  errors: Array<{ email?: string; message: string }>;
  rosterAvailable: boolean;
};

async function loadExistingKeys(): Promise<{
  emails: Set<string>;
  hrmsIds: Set<number>;
}> {
  const rows = (await query({
    query: `SELECT LOWER(TRIM(email)) AS email, hrms_staff_id FROM users WHERE email IS NOT NULL`,
    values: [],
  })) as { email: string; hrms_staff_id: number | null }[];

  const emails = new Set<string>();
  const hrmsIds = new Set<number>();
  for (const r of rows) {
    const e = String(r.email || '').trim().toLowerCase();
    if (e) emails.add(e);
    if (r.hrms_staff_id) hrmsIds.add(Number(r.hrms_staff_id));
  }
  return { emails, hrmsIds };
}

/** Import HR staff not yet in M&E (uses HR roster list API). */
export async function importNewStaffFromHrmsBatch(
  offset: number,
  limit: number,
  options: { dryRun?: boolean } = {}
): Promise<ImportNewSummary & { nextOffset: number | null }> {
  const { dryRun = false } = options;
  const roster = await getHrmsRoster();
  const summary: ImportNewSummary = {
    totalInRoster: roster.length,
    processed: 0,
    created: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    errors: [],
    rosterAvailable: roster.length > 0,
  };

  if (roster.length === 0) {
    return { ...summary, nextOffset: null };
  }

  const slice = roster.slice(offset, offset + limit);
  const { emails, hrmsIds } = await loadExistingKeys();

  for (const staff of slice) {
    summary.processed += 1;
    const email = normalizeHrmsEmail(staff.email);
    const hrmsId = Number(staff.id ?? staff.staffId ?? 0);

    if (!email || !hrmsId) {
      summary.skippedInvalid += 1;
      continue;
    }

    if (emails.has(email) || hrmsIds.has(hrmsId)) {
      summary.skippedExisting += 1;
      continue;
    }

    try {
      const result: HrmsSyncResult = await syncUserFromHrmsRecord(staff, {
        dryRun,
        createIfMissing: true,
      });
      if (result.action === 'created') {
        summary.created += 1;
        emails.add(email);
        hrmsIds.add(hrmsId);
      } else if (result.action === 'dry_run') {
        summary.created += 1;
      } else {
        summary.skippedExisting += 1;
      }
    } catch (e) {
      summary.errors.push({
        email,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const nextOffset = offset + slice.length < roster.length ? offset + limit : null;
  return { ...summary, nextOffset };
}
