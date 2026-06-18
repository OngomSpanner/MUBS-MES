/** Raw staff row from HRMS `staff` / `basic_info` arrays */
export type HrmsStaffRecord = {
  id?: number | string;
  staffId?: number | string;
  name?: string;
  userid?: number | string;
  firstname?: string;
  surname?: string;
  othernames?: string | null;
  email?: string;
  sex?: string | null;
  dob?: string | null;
  nationality?: string | null;
  psn?: string | null;
  dept?: string | null;
  pdept?: string | null;
  cat?: string | null;
  contract_terms?: string | null;
  contract_type?: string | null;
  contract_starts?: string | null;
  contract_ends?: string | null;
  appointment_date?: string | null;
  date_of_joining?: string | null;
  acc_status?: string | null;
  status?: string | null;
  ipps_no?: string | null;
  ifms_no?: string | null;
  id_no?: string | null;
  staff_no?: string | null;
  [key: string]: unknown;
};

export type HrmsSearchHit = {
  hrmsStaffId: number;
  name: string;
  email: string | null;
  sex: string | null;
  position: string;
  department: string;
  facultyOffice: string | null;
  category: string;
};

/** Fields written from HR (excludes password, role, managed_unit_id) */
export type MeUserHrmsPayload = {
  hrms_staff_id: number;
  email: string;
  full_name: string;
  first_name: string | null;
  surname: string | null;
  other_names: string | null;
  employee_id: string | null;
  position: string | null;
  staff_category: string | null;
  contract_terms: string | null;
  contract_type: string | null;
  contract_start: string | null;
  contract_end: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  gender: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  date_first_appointment: string | null;
  date_current_appointment: string | null;
  designation_grade: string | null;
  employment_status: string | null;
  faculty_office: string | null;
  department_id: number | null;
  department_name_unmapped: string | null;
};

export type HrmsSyncResult =
  | { action: 'created'; userId: number; email: string }
  | { action: 'updated'; userId: number; email: string }
  | { action: 'skipped'; reason: string; email?: string }
  | { action: 'dry_run'; would: 'create' | 'update'; email: string; hrmsStaffId: number };
