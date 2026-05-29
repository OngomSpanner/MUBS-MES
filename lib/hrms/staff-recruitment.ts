import { query } from '@/lib/db';
import {
  getPastCalendarYearWindow,
  labelsFromCalendarWindow,
  recruitedInCalendarYear,
  type CalendarYearWindowEntry,
} from '@/lib/calendar-year';
import {
  getManagedUnitDepartmentIds,
  listManagedUnitDepartments,
} from '@/lib/ambassador/managed-unit-departments';
import { normalizePositionLabel, POSITION_NOT_SPECIFIED } from '@/lib/hrms/staff-establishment';

export type { GenderCounts } from '@/lib/hrms/staff-establishment';
import type { GenderCounts } from '@/lib/hrms/staff-establishment';

export type RecruitmentTableRow = {
  designation: string;
  byYear: Record<string, GenderCounts>;
};

export type RecruitmentStaffListItem = {
  fullName: string;
  staffId: string;
  designation: string;
  faculty: string;
  department: string;
  gender: string;
  pwdStatus: string;
  dateFirstAppointment: string | null;
  recruitmentYear: string;
};

export type StaffRecruitmentReport = {
  facultyName: string;
  departmentName: string;
  /** Staff recruited in the 5-year window (after filters) */
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  rows: RecruitmentTableRow[];
  totals: Record<string, GenderCounts>;
  staffList: RecruitmentStaffListItem[];
  source: 'synced';
  syncedStaffCount: number;
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
  };
};

export type RecruitmentPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

type NormalizedStaff = {
  fullName: string;
  staffId: string;
  designation: string;
  gender: 'male' | 'female' | null;
  disability_status: string | null;
  isPwd: boolean;
  faculty: string;
  department: string;
  departmentId: number | null;
  dateFirstAppointment: string | null;
  recruitedYears: Set<string>;
};

function formatStaffId(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function formatGenderLabel(gender: 'male' | 'female' | null): string {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return '—';
}

function recruitmentCalendarYear(dateFirstAppointment: string | null): string {
  if (!dateFirstAppointment) return '—';
  const y = dateFirstAppointment.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : '—';
}

function emptyCounts(): GenderCounts {
  return { male: 0, female: 0, pwd: 0 };
}

function emptyCountsByYear(yearKeys: string[]): Record<string, GenderCounts> {
  return Object.fromEntries(yearKeys.map((k) => [k, emptyCounts()]));
}

function normalizeGender(sex: string | null | undefined): 'male' | 'female' | null {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return null;
}

function recruitedYearsForStaff(
  dateFirstAppointment: string | null,
  window: CalendarYearWindowEntry[]
): Set<string> {
  const years = new Set<string>();
  for (const cy of window) {
    if (recruitedInCalendarYear(dateFirstAppointment, cy)) years.add(cy.key);
  }
  return years;
}

type DbStaffRow = {
  designation_grade: string | null;
  position: string | null;
  gender: string | null;
  disability_status: string | null;
  faculty_office: string | null;
  department: string | null;
  date_first_appointment: string | null;
};

async function loadSyncedStaffForRecruitment(
  window: CalendarYearWindowEntry[],
  managedUnitId?: number
): Promise<NormalizedStaff[]> {
  const deptIds = managedUnitId ? await getManagedUnitDepartmentIds(managedUnitId) : null;
  const deptPlaceholders =
    deptIds && deptIds.length > 0 ? deptIds.map(() => '?').join(', ') : '';

  const rows = (await query({
    query: `
      SELECT
        u.full_name,
        u.hrms_staff_id,
        u.department_id,
        u.designation_grade,
        u.position,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
      ${deptIds && deptIds.length > 0 ? `AND u.department_id IN (${deptPlaceholders})` : managedUnitId ? 'AND 1 = 0' : ''}
    `,
    values: deptIds && deptIds.length > 0 ? deptIds : [],
  })) as (DbStaffRow & {
    full_name: string | null;
    hrms_staff_id: string | number | null;
    department_id: number | null;
  })[];

  return rows
    .map((r) => {
      const recruitedYears = recruitedYearsForStaff(r.date_first_appointment, window);
      if (recruitedYears.size === 0) return null;

      const disabilityStatus = r.disability_status?.trim() || null;
      return {
        fullName: (r.full_name || '').trim(),
        staffId: formatStaffId(r.hrms_staff_id),
        designation: normalizePositionLabel(r.designation_grade || r.position),
        gender: normalizeGender(r.gender),
        disability_status: disabilityStatus,
        isPwd: disabilityStatus === 'Yes',
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
        departmentId: r.department_id != null ? Number(r.department_id) : null,
        dateFirstAppointment: r.date_first_appointment,
        recruitedYears,
      };
    })
    .filter((s): s is NormalizedStaff => s !== null);
}

async function loadAllSyncedStaffForFilters(managedUnitId?: number): Promise<NormalizedStaff[]> {
  const deptIds = managedUnitId ? await getManagedUnitDepartmentIds(managedUnitId) : null;
  const deptPlaceholders =
    deptIds && deptIds.length > 0 ? deptIds.map(() => '?').join(', ') : '';

  const rows = (await query({
    query: `
      SELECT
        u.full_name,
        u.hrms_staff_id,
        u.department_id,
        u.designation_grade,
        u.position,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
      ${deptIds && deptIds.length > 0 ? `AND u.department_id IN (${deptPlaceholders})` : managedUnitId ? 'AND 1 = 0' : ''}
    `,
    values: deptIds && deptIds.length > 0 ? deptIds : [],
  })) as (DbStaffRow & {
    full_name: string | null;
    hrms_staff_id: string | number | null;
    department_id: number | null;
  })[];

  const window = getPastCalendarYearWindow();

  return rows.map((r) => {
    const disabilityStatus = r.disability_status?.trim() || null;
    return {
      fullName: (r.full_name || '').trim(),
      staffId: formatStaffId(r.hrms_staff_id),
      designation: normalizePositionLabel(r.designation_grade || r.position),
      gender: normalizeGender(r.gender),
      disability_status: disabilityStatus,
      isPwd: disabilityStatus === 'Yes',
      faculty: (r.faculty_office || '').trim(),
      department: (r.department || '').trim(),
      departmentId: r.department_id != null ? Number(r.department_id) : null,
      dateFirstAppointment: r.date_first_appointment,
      recruitedYears: recruitedYearsForStaff(r.date_first_appointment, window),
    };
  });
}

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: RecruitmentPwdFilter): boolean {
  if (pwdFilter === 'all') return true;
  if (pwdFilter === 'yes') return staff.disability_status === 'Yes';
  if (pwdFilter === 'no') return staff.disability_status === 'No';
  if (pwdFilter === 'not_recorded') return staff.disability_status == null;
  return true;
}

function matchesFilter(
  staff: NormalizedStaff,
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: RecruitmentPwdFilter,
  scopedDepartmentIds?: Set<number> | null
): boolean {
  if (scopedDepartmentIds && scopedDepartmentIds.size > 0) {
    if (!staff.departmentId || !scopedDepartmentIds.has(staff.departmentId)) return false;
  } else if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  return true;
}

function addToCounts(target: GenderCounts, staff: NormalizedStaff) {
  if (staff.gender === 'male') target.male += 1;
  else if (staff.gender === 'female') target.female += 1;
  if (staff.isPwd) target.pwd += 1;
}

function sortDesignations(a: string, b: string): number {
  if (a === POSITION_NOT_SPECIFIED) return 1;
  if (b === POSITION_NOT_SPECIFIED) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function buildDepartmentFilterOptions(staffList: NormalizedStaff[]): {
  allDepartments: string[];
  departmentsByFaculty: Record<string, string[]>;
} {
  const all = new Set<string>();
  const byFaculty = new Map<string, Set<string>>();

  for (const s of staffList) {
    if (s.department) all.add(s.department);
    if (!s.faculty || !s.department) continue;
    if (!byFaculty.has(s.faculty)) byFaculty.set(s.faculty, new Set());
    byFaculty.get(s.faculty)!.add(s.department);
  }

  const departmentsByFaculty: Record<string, string[]> = {};
  for (const [faculty, depts] of byFaculty) {
    departmentsByFaculty[faculty] = Array.from(depts).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }

  return {
    allDepartments: Array.from(all).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    departmentsByFaculty,
  };
}

export function buildRecruitmentReport(
  staffSource: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  pwdFilter: RecruitmentPwdFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  syncedStaffCount: number,
  window: CalendarYearWindowEntry[] = getPastCalendarYearWindow(),
  options?: { scopedDepartmentIds?: number[]; scopedFacultyLabel?: string | null }
): StaffRecruitmentReport {
  const yearKeys = window.map((y) => y.key);
  const years = labelsFromCalendarWindow(window);
  const scopedDepartmentIds = options?.scopedDepartmentIds?.length
    ? new Set(options.scopedDepartmentIds)
    : null;

  const filtered = staffSource.filter((s) =>
    matchesFilter(s, facultyFilter, departmentFilter, pwdFilter, scopedDepartmentIds)
  );

  const rowByDesignation = new Map<string, RecruitmentTableRow>();
  const totals = emptyCountsByYear(yearKeys);

  for (const staff of filtered) {
    let row = rowByDesignation.get(staff.designation);
    if (!row) {
      row = {
        designation: staff.designation,
        byYear: emptyCountsByYear(yearKeys),
      };
      rowByDesignation.set(staff.designation, row);
    }

    for (const yearKey of staff.recruitedYears) {
      if (!yearKeys.includes(yearKey)) continue;
      addToCounts(row.byYear[yearKey], staff);
      addToCounts(totals[yearKey], staff);
    }
  }

  const rows = Array.from(rowByDesignation.values())
    .filter((row) =>
      yearKeys.some((k) => {
        const c = row.byYear[k];
        return c.male + c.female + c.pwd > 0;
      })
    )
    .sort((a, b) => sortDesignations(a.designation, b.designation));

  const facultyName =
    options?.scopedFacultyLabel?.trim() ||
    (facultyFilter && facultyFilter !== 'All Faculties' ? facultyFilter : '—');
  const departmentName =
    departmentFilter && departmentFilter !== 'All Departments' ? departmentFilter : '—';

  const staffList: RecruitmentStaffListItem[] = filtered
    .map((s) => ({
      fullName: s.fullName || '—',
      staffId: s.staffId || '—',
      designation: s.designation,
      faculty: s.faculty || '—',
      department: s.department || '—',
      gender: formatGenderLabel(s.gender),
      pwdStatus: s.disability_status ?? 'Not recorded',
      dateFirstAppointment: s.dateFirstAppointment,
      recruitmentYear: recruitmentCalendarYear(s.dateFirstAppointment),
    }))
    .sort((a, b) => {
      const yearCmp = b.recruitmentYear.localeCompare(a.recruitmentYear);
      if (yearCmp !== 0) return yearCmp;
      return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
    });

  return {
    facultyName,
    departmentName,
    numberOfStaff: filtered.length,
    yearKeys,
    years,
    rows,
    totals,
    staffList,
    source: 'synced',
    syncedStaffCount,
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): RecruitmentPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

export async function generateStaffRecruitmentReport(options: {
  faculty?: string | null;
  department?: string | null;
  pwd?: string | null;
  managedUnitId?: number | null;
}): Promise<StaffRecruitmentReport> {
  const window = getPastCalendarYearWindow();
  const managedUnitId =
    options.managedUnitId != null && Number.isFinite(options.managedUnitId)
      ? Number(options.managedUnitId)
      : null;

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const [staffList, allForFilters] = await Promise.all([
    loadSyncedStaffForRecruitment(window, managedUnitId ?? undefined),
    loadAllSyncedStaffForFilters(managedUnitId ?? undefined),
  ]);

  let faculties = Array.from(new Set(allForFilters.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  let departmentFilterOptions = buildDepartmentFilterOptions(allForFilters);
  let facultyFilter = options.faculty || null;
  let scopedDepartmentIds: number[] | undefined;
  let scopedFacultyLabel: string | null = null;

  if (managedUnitId) {
    const unitRows = (await query({
      query: 'SELECT name FROM departments WHERE id = ? LIMIT 1',
      values: [managedUnitId],
    })) as { name: string }[];
    const managedUnitName = (unitRows[0]?.name || '').trim();
    const childDepartments = await listManagedUnitDepartments(managedUnitId);
    const deptNames = childDepartments.map((d) => d.name);

    scopedDepartmentIds = await getManagedUnitDepartmentIds(managedUnitId);
    scopedFacultyLabel = managedUnitName || null;
    faculties = managedUnitName ? [managedUnitName] : [];
    facultyFilter = null;
    departmentFilterOptions = {
      allDepartments: deptNames,
      departmentsByFaculty: managedUnitName ? { [managedUnitName]: deptNames } : {},
    };
  }

  return buildRecruitmentReport(
    staffList,
    facultyFilter,
    options.department || null,
    normalizePwdFilter(options.pwd),
    faculties,
    departmentFilterOptions,
    syncedStaffCount,
    window,
    scopedDepartmentIds ? { scopedDepartmentIds, scopedFacultyLabel } : undefined
  );
}
