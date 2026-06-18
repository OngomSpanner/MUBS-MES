import axios, { type AxiosRequestConfig } from 'axios';
import type { HrmsSearchHit, HrmsStaffRecord } from './types';
import { normalizeHrmsEmail } from './parse-date';

function hrmsConfig() {
  const apiUrl = (process.env.HRMS_API_URL || 'https://hrms.mubs.ac.ug').replace(/\/$/, '');
  return {
    bioUrl: process.env.HRMS_BIO_URL || `${apiUrl}/bio`,
    timeoutMs: Number(process.env.HRMS_TIMEOUT_MS) || 20000,
    apiKey: process.env.HRMS_API_KEY || '',
    apiSecret: process.env.HRMS_API_SECRET || '',
    requireAuth:
      process.env.REQUIRE_AUTH === 'true' || process.env.HRMS_REQUIRE_AUTH === 'true',
  };
}

export function getHrmsBioUrl(): string {
  return hrmsConfig().bioUrl;
}

function hrmsAuthHeaders(): Record<string, string> {
  const { apiKey, apiSecret } = hrmsConfig();
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;
  if (apiSecret) headers['x-api-secret'] = apiSecret;
  return headers;
}

function assertHrmsAuthConfigured(): void {
  const { requireAuth, apiKey, apiSecret } = hrmsConfig();
  if (!requireAuth) return;
  if (!apiKey || !apiSecret) {
    throw new Error(
      'HRMS API auth required but HRMS_API_KEY or HRMS_API_SECRET is missing in environment'
    );
  }
}

async function hrmsBioGet(
  params: Record<string, string>,
  config: AxiosRequestConfig = {}
): Promise<Record<string, unknown>> {
  assertHrmsAuthConfigured();
  const { bioUrl, timeoutMs } = hrmsConfig();
  const response = await axios.get(bioUrl, {
    ...config,
    params,
    timeout: timeoutMs,
    headers: {
      ...hrmsAuthHeaders(),
      ...(config.headers as Record<string, string> | undefined),
    },
  });
  return (response.data || {}) as Record<string, unknown>;
}

function pickStaffArray(data: Record<string, unknown>): HrmsStaffRecord[] {
  const staff = data.staff;
  if (Array.isArray(staff) && staff.length > 0) return staff as HrmsStaffRecord[];
  const basic = data.basic_info;
  if (Array.isArray(basic) && basic.length > 0) return basic as HrmsStaffRecord[];
  return [];
}

function formatStaffName(s: HrmsStaffRecord): string {
  const preformatted = s.name ? String(s.name).trim() : '';
  if (preformatted) return preformatted;
  return `${s.firstname || ''} ${s.surname || ''}${s.othernames ? ` ${s.othernames}` : ''}`.trim();
}

export function toSearchHit(s: HrmsStaffRecord): HrmsSearchHit | null {
  const hrmsStaffId = Number(s.id ?? s.staffId ?? 0);
  if (!hrmsStaffId) return null;
  const name = formatStaffName(s);
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

  const data = await hrmsBioGet({ rq: 'search-staff', crit: 'name', name });
  const rows = pickStaffArray(data);
  return rows.map(toSearchHit).filter((h): h is HrmsSearchHit => h !== null);
}

export async function hrmsFetchStaffBySearch(query: string): Promise<HrmsStaffRecord | null> {
  const name = String(query || '').trim();
  if (name.length < 3) return null;

  const data = await hrmsBioGet({ rq: 'search-staff', crit: 'name', name });
  const rows = pickStaffArray(data);
  if (rows.length === 0) return null;

  if (rows.length === 1) return rows[0];

  const q = normalizeHrmsEmail(query);
  if (q) {
    const byEmail = rows.find((r) => normalizeHrmsEmail(r.email) === q);
    if (byEmail) return byEmail;
  }

  const qLower = name.toLowerCase();
  const byName = rows.find((r) => {
    const full = formatStaffName(r).toLowerCase();
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
      const data = await hrmsBioGet({ rq });
      const rows = pickStaffArray(data);
      if (rows.length > 0) {
        return rows;
      }
    } catch {
      // try next
    }
  }
  return [];
}
