import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { hrmsFetchStaffBySearch } from './client';
import { clearDepartmentCache } from './departments';
import { mapHrmsStaffToMeUser } from './map-staff';
import type { HrmsStaffRecord, HrmsSyncResult } from './types';

type DbUserRow = { id: number; email: string; hrms_staff_id?: number | null };

const DEFAULT_PASSWORD = process.env.HRMS_SYNC_DEFAULT_PASSWORD || 'Welcome@2025';

async function findExistingUser(
  hrmsStaffId: number,
  email: string
): Promise<DbUserRow | null> {
  const byHrms = (await query({
    query: 'SELECT id, email, hrms_staff_id FROM users WHERE hrms_staff_id = ? LIMIT 1',
    values: [hrmsStaffId],
  })) as DbUserRow[];
  if (byHrms[0]) return byHrms[0];

  const byEmail = (await query({
    query: 'SELECT id, email, hrms_staff_id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
    values: [email],
  })) as DbUserRow[];
  return byEmail[0] || null;
}

export async function syncUserFromHrmsRecord(
  staff: HrmsStaffRecord,
  options: { dryRun?: boolean; createIfMissing?: boolean } = {}
): Promise<HrmsSyncResult> {
  const { dryRun = false, createIfMissing = true } = options;
  clearDepartmentCache();
  const mapped = await mapHrmsStaffToMeUser(staff);
  if (!mapped) {
    return { action: 'skipped', reason: 'Missing HRMS id or valid email' };
  }

  const existing = await findExistingUser(mapped.hrms_staff_id, mapped.email);

  if (dryRun) {
    return {
      action: 'dry_run',
      would: existing ? 'update' : 'create',
      email: mapped.email,
      hrmsStaffId: mapped.hrms_staff_id,
    };
  }

  if (existing) {
    await query({
      query: `UPDATE users SET
        hrms_staff_id = ?,
        hrms_last_synced_at = NOW(),
        email = ?,
        full_name = ?,
        first_name = COALESCE(?, first_name),
        surname = COALESCE(?, surname),
        other_names = COALESCE(?, other_names),
        employee_id = COALESCE(?, employee_id),
        position = COALESCE(?, position),
        staff_category = COALESCE(?, staff_category),
        contract_terms = COALESCE(?, contract_terms),
        contract_type = COALESCE(?, contract_type),
        contract_start = COALESCE(?, contract_start),
        contract_end = COALESCE(?, contract_end),
        contract_start_date = COALESCE(?, contract_start_date),
        contract_end_date = COALESCE(?, contract_end_date),
        gender = COALESCE(?, gender),
        nationality = COALESCE(?, nationality),
        date_of_birth = COALESCE(?, date_of_birth),
        date_first_appointment = COALESCE(?, date_first_appointment),
        date_current_appointment = COALESCE(?, date_current_appointment),
        designation_grade = COALESCE(?, designation_grade),
        employment_status = COALESCE(?, employment_status),
        faculty_office = COALESCE(?, faculty_office),
        department_id = COALESCE(?, department_id)
      WHERE id = ?`,
      values: [
        mapped.hrms_staff_id,
        mapped.email,
        mapped.full_name,
        mapped.first_name,
        mapped.surname,
        mapped.other_names,
        mapped.employee_id,
        mapped.position,
        mapped.staff_category,
        mapped.contract_terms,
        mapped.contract_type,
        mapped.contract_start,
        mapped.contract_end,
        mapped.contract_start_date,
        mapped.contract_end_date,
        mapped.gender,
        mapped.nationality,
        mapped.date_of_birth,
        mapped.date_first_appointment,
        mapped.date_current_appointment,
        mapped.designation_grade,
        mapped.employment_status,
        mapped.faculty_office,
        mapped.department_id,
        existing.id,
      ],
    });
    return { action: 'updated', userId: existing.id, email: mapped.email };
  }

  if (!createIfMissing) {
    return { action: 'skipped', reason: 'No M&E user; create disabled', email: mapped.email };
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const result = await query({
    query: `INSERT INTO users (
      hrms_staff_id, hrms_last_synced_at,
      full_name, email, password_hash, role, department_id, status, must_change_password,
      first_name, surname, other_names, employee_id, contract_terms, contract_type, staff_category,
      position, contract_start, contract_end, contract_start_date, contract_end_date,
      gender, nationality, designation_grade,
      date_of_birth, date_first_appointment, date_current_appointment,
      employment_status, leave_status, faculty_office
    ) VALUES (
      ?, NOW(),
      ?, ?, ?, 'staff', ?, 'Active', 1,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, 'On Duty', ?
    )`,
    values: [
      mapped.hrms_staff_id,
      mapped.full_name,
      mapped.email,
      hashedPassword,
      mapped.department_id,
      mapped.first_name,
      mapped.surname,
      mapped.other_names,
      mapped.employee_id,
      mapped.contract_terms,
      mapped.contract_type,
      mapped.staff_category,
      mapped.position,
      mapped.contract_start,
      mapped.contract_end,
      mapped.contract_start_date,
      mapped.contract_end_date,
      mapped.gender,
      mapped.nationality,
      mapped.designation_grade,
      mapped.date_of_birth,
      mapped.date_first_appointment,
      mapped.date_current_appointment,
      mapped.employment_status,
      mapped.faculty_office,
    ],
  });

  const userId = (result as { insertId?: number }).insertId ?? 0;
  try {
    await query({
      query: `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, 'staff')`,
      values: [userId],
    });
  } catch {
    /* user_roles optional */
  }

  return { action: 'created', userId, email: mapped.email };
}

export async function syncUserFromHrmsSearch(
  searchQuery: string,
  options: { dryRun?: boolean; createIfMissing?: boolean } = {}
): Promise<HrmsSyncResult> {
  const staff = await hrmsFetchStaffBySearch(searchQuery);
  if (!staff) {
    return {
      action: 'skipped',
      reason: `Not found in HRMS — M&E record left unchanged`,
      email: searchQuery.includes('@') ? searchQuery.trim().toLowerCase() : undefined,
    };
  }
  return syncUserFromHrmsRecord(staff, options);
}

export type SyncBatchSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  skippedNotInHr: number;
  dryRun: number;
  errors: Array<{ query: string; message: string }>;
};

export async function syncBatchFromSearchQueries(
  queries: string[],
  options: { dryRun?: boolean; createIfMissing?: boolean; delayMs?: number } = {}
): Promise<SyncBatchSummary> {
  const { dryRun = false, createIfMissing = true, delayMs = 150 } = options;
  const summary: SyncBatchSummary = {
    total: queries.length,
    created: 0,
    updated: 0,
    skipped: 0,
    skippedNotInHr: 0,
    dryRun: 0,
    errors: [],
  };

  for (const q of queries) {
    try {
      const result = await syncUserFromHrmsSearch(q.trim(), { dryRun, createIfMissing });
      if (result.action === 'created') summary.created += 1;
      else if (result.action === 'updated') summary.updated += 1;
      else if (result.action === 'dry_run') summary.dryRun += 1;
      else {
        summary.skipped += 1;
        if (
          result.action === 'skipped' &&
          (result.reason.includes('No HRMS match') ||
            result.reason.includes('not found in HR'))
        ) {
          summary.skippedNotInHr += 1;
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[HRMS sync]', q, message);
      summary.errors.push({ query: q, message });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return summary;
}
