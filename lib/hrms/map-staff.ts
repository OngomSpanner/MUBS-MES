import { isEmploymentStatus, isGender } from '@/lib/staff-biodata';
import { normalizeStaffCategory } from '@/lib/staff-categories';
import { resolveDepartmentId } from './departments';
import { normalizeHrmsEmail, parseHrmsDate } from './parse-date';
import type { HrmsStaffRecord, MeUserHrmsPayload } from './types';

function mapGender(sex: string | null | undefined): string | null {
  if (!sex) return null;
  const s = String(sex).trim();
  if (s === 'Male' || s === 'Female') return s;
  if (s.toLowerCase() === 'm') return 'Male';
  if (s.toLowerCase() === 'f') return 'Female';
  if (isGender(s)) return s;
  return null;
}

function mapEmploymentStatus(accStatus: string | null | undefined): string {
  const s = (accStatus || '').toLowerCase();
  if (s.includes('active')) return 'active';
  if (s.includes('leave')) return 'on_leave';
  if (s.includes('retir')) return 'retired';
  if (s.includes('resign')) return 'resigned';
  if (s.includes('termin')) return 'terminated';
  if (s.includes('dismiss')) return 'dismissed';
  if (s.includes('deceas')) return 'deceased';
  const candidate = 'active';
  return isEmploymentStatus(candidate) ? candidate : 'active';
}

export async function mapHrmsStaffToMeUser(staff: HrmsStaffRecord): Promise<MeUserHrmsPayload | null> {
  const hrmsStaffId = Number(staff.id ?? staff.staffId ?? 0);
  const email = normalizeHrmsEmail(staff.email);
  if (!hrmsStaffId || !email) return null;

  const first_name = staff.firstname ? String(staff.firstname).trim() : null;
  const surname = staff.surname ? String(staff.surname).trim() : null;
  const other_names = staff.othernames ? String(staff.othernames).trim() : null;
  const full_name =
    `${first_name || ''} ${surname || ''}${other_names ? ` ${other_names}` : ''}`.trim() || email;

  const contract_start =
    parseHrmsDate(staff.contract_starts) ||
    parseHrmsDate(staff.date_of_joining) ||
    parseHrmsDate(staff.appointment_date);
  const contract_end = parseHrmsDate(staff.contract_ends);
  const date_first_appointment =
    parseHrmsDate(staff.appointment_date) || parseHrmsDate(staff.date_of_joining);
  const date_current_appointment = parseHrmsDate(staff.appointment_date);

  const deptName = staff.dept ? String(staff.dept).trim() : null;
  const department_id = await resolveDepartmentId(deptName);

  const employee_id =
    (staff.ipps_no && String(staff.ipps_no).trim()) ||
    (staff.ifms_no && String(staff.ifms_no).trim()) ||
    (staff.id_no && String(staff.id_no).trim()) ||
    null;

  const staff_category = normalizeStaffCategory(staff.cat ? String(staff.cat) : null);

  return {
    hrms_staff_id: hrmsStaffId,
    email,
    full_name,
    first_name,
    surname,
    other_names,
    employee_id,
    position: staff.psn ? String(staff.psn).trim() : null,
    staff_category,
    contract_terms: staff.contract_terms ? String(staff.contract_terms).trim() : null,
    contract_type: staff.contract_type ? String(staff.contract_type).trim() : null,
    contract_start,
    contract_end,
    contract_start_date: contract_start,
    contract_end_date: contract_end,
    gender: mapGender(staff.sex),
    nationality: staff.nationality ? String(staff.nationality).trim() : null,
    date_of_birth: parseHrmsDate(staff.dob),
    date_first_appointment,
    date_current_appointment,
    designation_grade: staff.psn ? String(staff.psn).trim() : null,
    employment_status: mapEmploymentStatus(staff.acc_status),
    faculty_office: staff.pdept ? String(staff.pdept).trim() : null,
    department_id,
    department_name_unmapped: department_id ? null : deptName,
  };
}
