import axios from 'axios';
import type { HrmsSearchHit, HrmsStaffRecord } from './types';
import { normalizeHrmsEmail } from './parse-date';

const HRMS_BIO_URL = process.env.HRMS_BIO_URL || 'https://hrms.mubs.ac.ug/bio';
const HRMS_TIMEOUT_MS = Number(process.env.HRMS_TIMEOUT_MS) || 20000;

export function getHrmsBioUrl(): string {
  return HRMS_BIO_URL;
}

function pickStaffArray(data: Record<string, unknown>): HrmsStaffRecord[] {
  const staff = data.staff;
  if (Array.isArray(staff) && staff.length > 0) return staff as HrmsStaffRecord[];
  const basic = data.basic_info;
  if (Array.isArray(basic) && basic.length > 0) return basic as HrmsStaffRecord[];
  return [];
}

export function toSearchHit(s: HrmsStaffRecord): HrmsSearchHit | null {
  const hrmsStaffId = Number(s.id ?? s.staffId ?? 0);
  if (!hrmsStaffId) return null;
  const name = `${s.firstname || ''} ${s.surname || ''}${s.othernames ? ` ${s.othernames}` : ''}`.trim();
  return {
    hrmsStaffId,
    name: name || 'Unknown',
    email: normalizeHrmsEmail(s.email),
    sex: s.sex ? String(s.sex) : null,
    position: s.psn ? String(s.psn) : 'Staff',
    department: s.dept ? String(s.dept) : 'N/A',
    facultyOffice: s.pdept ? String(s.pdept) : null,
    category: s.cat ? String(s.cat) : 'Academic',
  };
}

export async function hrmsSearchStaff(query: string): Promise<HrmsSearchHit[]> {
  const name = String(query || '').trim();
  if (name.length < 3) return [];

  const response = await axios.get(HRMS_BIO_URL, {
    params: { rq: 'search-staff', crit: 'name', name },
    timeout: HRMS_TIMEOUT_MS,
  });

  const rows = pickStaffArray(response.data || {});
  return rows.map(toSearchHit).filter((h): h is HrmsSearchHit => h !== null);
}

export async function hrmsFetchStaffBySearch(query: string): Promise<HrmsStaffRecord | null> {
  const name = String(query || '').trim();
  if (name.length < 3) return null;

  const response = await axios.get(HRMS_BIO_URL, {
    params: { rq: 'search-staff', crit: 'name', name },
    timeout: HRMS_TIMEOUT_MS,
  });

  const rows = pickStaffArray(response.data || {});
  if (rows.length === 0) return null;

  if (rows.length === 1) return rows[0];

  const q = normalizeHrmsEmail(query);
  if (q) {
    const byEmail = rows.find((r) => normalizeHrmsEmail(r.email) === q);
    if (byEmail) return byEmail;
  }

  const qLower = name.toLowerCase();
  const byName = rows.find((r) => {
    const full = `${r.firstname || ''} ${r.surname || ''}`.trim().toLowerCase();
    return full === qLower || full.includes(qLower);
  });
  return byName || rows[0];
}

/** Try optional roster endpoints; returns [] if none work */
export async function hrmsTryListAllStaff(): Promise<HrmsStaffRecord[]> {
  const candidates = [
    'list-staff',
    'list-active-staff',
    'active-staff',
    'all-staff',
    'staff-list',
    'get-staff-list',
    'staff-roster',
    'export-staff',
  ];
  for (const rq of candidates) {
    try {
      const response = await axios.get(HRMS_BIO_URL, {
        params: { rq },
        timeout: HRMS_TIMEOUT_MS,
      });
      const rows = pickStaffArray(response.data || {});
      if (rows.length > 0) {
        return rows;
      }
    } catch {
      // try next
    }
  }
  return [];
}
