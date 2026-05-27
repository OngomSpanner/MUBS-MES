import { query } from '@/lib/db';
import {
  getStaffDevelopmentAyWindow,
  labelsFromFyWindow,
  type FinancialYearWindowEntry,
} from '@/lib/financial-year';

export type StaffTypeFilter = 'all' | 'teaching' | 'non_teaching';

export type DevelopmentYearCell = {
  educationLevel: string;
  programme: string;
  gender: string;
  pwd: string;
};

export type StaffDevelopmentRow = {
  staffName: string;
  staffType: string;
  staffCategory: string | null;
  byYear: Record<string, DevelopmentYearCell>;
  recommendedAnyYear: boolean;
};

export type TrainingImplementationRow = {
  yearKey: string;
  yearLabel: string;
  completed: number;
  ongoing: number;
};

export type StaffDevelopmentReport = {
  facultyName: string;
  departmentName: string;
  staffTypeName: string;
  academicYearName: string;
  selectedYearKey: string;
  recommendedCount: number;
  participantsCount: number;
  numberOfStaff: number;
  yearKeys: string[];
  years: Record<string, string>;
  rows: StaffDevelopmentRow[];
  trainingImplementation: TrainingImplementationRow[];
  source: 'synced';
  syncedStaffCount: number;
  filterOptions: {
    faculties: string[];
    departments: string[];
    departmentsByFaculty: Record<string, string[]>;
    staffTypes: { value: string; label: string }[];
    academicYears: { key: string; label: string }[];
  };
};

export type DevelopmentPwdFilter = 'all' | 'yes' | 'no' | 'not_recorded';

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

type NormalizedStaff = {
  userId: number;
  staffName: string;
  staffCategory: string | null;
  staffType: string;
  gender: string;
  pwd: string;
  faculty: string;
  department: string;
  disability_status: string | null;
  developmentByYear: Map<
    string,
    { educationLevel: string; programme: string; isRecommended: boolean; trainingStatus: string | null }
  >;
};

function yearEntryParticipated(entry: {
  educationLevel: string;
  programme: string;
  trainingStatus: string | null;
}): boolean {
  if (entry.trainingStatus === 'completed' || entry.trainingStatus === 'ongoing') return true;
  const prog = entry.programme.trim();
  const edu = entry.educationLevel.trim();
  return (prog.length > 0 && prog !== '—') || (edu.length > 0 && edu !== '—');
}

function staffParticipatedInWindow(
  devByYear: Map<string, { educationLevel: string; programme: string; trainingStatus: string | null }>,
  yearKeys: string[]
): boolean {
  for (const key of yearKeys) {
    const entry = devByYear.get(key);
    if (entry && yearEntryParticipated(entry)) return true;
  }
  return false;
}

function resolveSelectedYear(
  window: FinancialYearWindowEntry[],
  academicYear?: string | null
): FinancialYearWindowEntry {
  const raw = (academicYear || '').trim();
  if (raw) {
    const byKey = window.find((y) => y.key === raw);
    if (byKey) return byKey;
    const byLabel = window.find((y) => y.label === raw);
    if (byLabel) return byLabel;
  }
  return window[window.length - 1];
}

function emptyYearCell(gender: string, pwd: string): DevelopmentYearCell {
  return {
    educationLevel: '—',
    programme: '—',
    gender,
    pwd,
  };
}

export function staffTypeFromCategory(category: string | null): string {
  return category === 'Academic' ? 'Teaching' : 'Non-teaching';
}

function normalizeGender(sex: string | null | undefined): string {
  const s = (sex || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'Male';
  if (s === 'female' || s === 'f') return 'Female';
  return '—';
}

function formatPwd(disabilityStatus: string | null): string {
  if (disabilityStatus === 'Yes') return 'Yes';
  if (disabilityStatus === 'No') return 'No';
  return '—';
}

function isSeparatedEmployment(employmentStatus: string | null | undefined): boolean {
  const emp = (employmentStatus || '').toLowerCase();
  return SEPARATED_EMPLOYMENT.some((x) => emp.includes(x));
}

function matchesStaffType(category: string | null, filter: StaffTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'teaching') return category === 'Academic';
  return category !== 'Academic';
}

function matchesPwdFilter(staff: NormalizedStaff, pwdFilter: DevelopmentPwdFilter): boolean {
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
  staffTypeFilter: StaffTypeFilter,
  pwdFilter: DevelopmentPwdFilter
): boolean {
  if (facultyFilter && facultyFilter !== 'All Faculties') {
    if (staff.faculty.toLowerCase() !== facultyFilter.toLowerCase()) return false;
  }
  if (departmentFilter && departmentFilter !== 'All Departments') {
    if (staff.department.toLowerCase() !== departmentFilter.toLowerCase()) return false;
  }
  if (!matchesStaffType(staff.staffCategory, staffTypeFilter)) return false;
  if (!matchesPwdFilter(staff, pwdFilter)) return false;
  return true;
}

async function loadDevelopmentEntries(
  window: FinancialYearWindowEntry[]
): Promise<
  Map<
    number,
    Map<string, { educationLevel: string; programme: string; isRecommended: boolean; trainingStatus: string | null }>
  >
> {
  const keys = window.map((y) => y.key);
  if (keys.length === 0) return new Map();

  const placeholders = keys.map(() => '?').join(',');
  let rows: {
    user_id: number;
    academic_year_key: string;
    education_level: string | null;
    programme: string | null;
    training_status: string | null;
    is_recommended: number;
  }[] = [];
  try {
    rows = (await query({
      query: `
        SELECT user_id, academic_year_key, education_level, programme, training_status, is_recommended
        FROM staff_development_entries
        WHERE academic_year_key IN (${placeholders})
      `,
      values: keys,
    })) as typeof rows;
  } catch {
    try {
      const legacyRows = (await query({
        query: `
          SELECT user_id, academic_year_key, education_level, programme, is_recommended
          FROM staff_development_entries
          WHERE academic_year_key IN (${placeholders})
        `,
        values: keys,
      })) as {
        user_id: number;
        academic_year_key: string;
        education_level: string | null;
        programme: string | null;
        is_recommended: number;
      }[];
      rows = legacyRows.map((r) => ({ ...r, training_status: null }));
    } catch {
      return new Map();
    }
  }

  const byUser = new Map<
    number,
    Map<string, { educationLevel: string; programme: string; isRecommended: boolean; trainingStatus: string | null }>
  >();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map());
    byUser.get(r.user_id)!.set(r.academic_year_key, {
      educationLevel: (r.education_level || '').trim() || '—',
      programme: (r.programme || '').trim() || '—',
      isRecommended: Boolean(r.is_recommended),
      trainingStatus: r.training_status?.trim() || null,
    });
  }
  return byUser;
}

async function loadTrainingImplementation(
  windowSlice: FinancialYearWindowEntry[]
): Promise<TrainingImplementationRow[]> {
  if (windowSlice.length === 0) return [];

  const yearKeys = windowSlice.map((y) => y.key);
  const placeholders = yearKeys.map(() => '?').join(',');
  let rows: { academic_year_key: string; completed_count: number; ongoing_count: number }[] = [];
  try {
    rows = (await query({
      query: `
        SELECT academic_year_key, completed_count, ongoing_count
        FROM staff_training_implementation
        WHERE academic_year_key IN (${placeholders})
      `,
      values: yearKeys,
    })) as typeof rows;
  } catch {
    rows = [];
  }

  const byKey = new Map(rows.map((r) => [r.academic_year_key, r]));

  return windowSlice.map((y) => {
    const row = byKey.get(y.key);
    return {
      yearKey: y.key,
      yearLabel: y.label,
      completed: Number(row?.completed_count ?? 0),
      ongoing: Number(row?.ongoing_count ?? 0),
    };
  });
}

async function loadActiveHrStaff(
  devByUser: Map<
    number,
    Map<string, { educationLevel: string; programme: string; isRecommended: boolean; trainingStatus: string | null }>
  >,
  yearKeys: string[]
): Promise<NormalizedStaff[]> {
  const participantIds = [...devByUser.entries()]
    .filter(([, byYear]) => staffParticipatedInWindow(byYear, yearKeys))
    .map(([userId]) => userId);

  if (participantIds.length === 0) return [];

  const placeholders = participantIds.map(() => '?').join(',');
  const rows = (await query({
    query: `
      SELECT
        u.id AS user_id,
        u.full_name,
        u.staff_category,
        u.gender,
        u.disability_status,
        u.faculty_office,
        COALESCE(d.name, '') AS department,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND u.id IN (${placeholders})
    `,
    values: participantIds,
  })) as {
    user_id: number;
    full_name: string | null;
    staff_category: string | null;
    gender: string | null;
    disability_status: string | null;
    faculty_office: string | null;
    department: string | null;
    employment_status: string | null;
  }[];

  return rows
    .filter((r) => !isSeparatedEmployment(r.employment_status))
    .map((r) => {
      const disabilityStatus = r.disability_status?.trim() || null;
      const gender = normalizeGender(r.gender);
      const pwd = formatPwd(disabilityStatus);
      const userDev = devByUser.get(r.user_id) ?? new Map();

      return {
        userId: r.user_id,
        staffName: (r.full_name || '').trim() || '—',
        staffCategory: r.staff_category,
        staffType: staffTypeFromCategory(r.staff_category),
        gender,
        pwd,
        faculty: (r.faculty_office || '').trim(),
        department: (r.department || '').trim(),
        disability_status: disabilityStatus,
        developmentByYear: userDev,
      };
    });
}

async function loadFilterOptions(
  yearKeys: string[],
  participantIds: number[]
): Promise<{ faculty: string; department: string }[]> {
  if (participantIds.length === 0) return [];

  const yearPlaceholders = yearKeys.map(() => '?').join(',');
  const idPlaceholders = participantIds.map(() => '?').join(',');
  let rows: { faculty_office: string | null; department: string }[] = [];
  try {
    rows = (await query({
      query: `
        SELECT DISTINCT u.faculty_office, COALESCE(d.name, '') AS department
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        INNER JOIN staff_development_entries sde ON sde.user_id = u.id
        WHERE u.hrms_staff_id IS NOT NULL
          AND u.id IN (${idPlaceholders})
          AND sde.academic_year_key IN (${yearPlaceholders})
      `,
      values: [...participantIds, ...yearKeys],
    })) as typeof rows;
  } catch {
    return [];
  }

  return rows.map((r) => ({
    faculty: (r.faculty_office || '').trim(),
    department: (r.department || '').trim(),
  }));
}

function buildDepartmentFilterOptions(staffList: { faculty: string; department: string }[]) {
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

export function buildStaffDevelopmentReport(
  staffList: NormalizedStaff[],
  facultyFilter: string | null,
  departmentFilter: string | null,
  staffTypeFilter: StaffTypeFilter,
  pwdFilter: DevelopmentPwdFilter,
  allFaculties: string[],
  departmentFilterOptions: { allDepartments: string[]; departmentsByFaculty: Record<string, string[]> },
  syncedStaffCount: number,
  window: FinancialYearWindowEntry[],
  selectedYear: FinancialYearWindowEntry,
  trainingImplementation: TrainingImplementationRow[]
): StaffDevelopmentReport {
  const displayYearKeys = [selectedYear.key];
  const years = labelsFromFyWindow(window);

  const filtered = staffList
    .filter((s) => staffParticipatedInWindow(s.developmentByYear, displayYearKeys))
    .filter((s) => matchesFilter(s, facultyFilter, departmentFilter, staffTypeFilter, pwdFilter))
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: 'base' }));

  const rows: StaffDevelopmentRow[] = filtered.map((staff) => {
    const key = selectedYear.key;
    const dev = staff.developmentByYear.get(key);
    const byYear: Record<string, DevelopmentYearCell> = {
      [key]: dev
        ? {
            educationLevel: dev.educationLevel,
            programme: dev.programme,
            gender: staff.gender,
            pwd: staff.pwd,
          }
        : emptyYearCell(staff.gender, staff.pwd),
    };

    return {
      staffName: staff.staffName,
      staffType: staff.staffType,
      staffCategory: staff.staffCategory,
      byYear,
      recommendedAnyYear: Boolean(dev?.isRecommended),
    };
  });

  const recommendedCount = rows.filter((r) => r.recommendedAnyYear).length;
  const participantsCount = rows.length;

  const facultyName =
    facultyFilter && facultyFilter !== 'All Faculties' ? facultyFilter : '—';
  const departmentName =
    departmentFilter && departmentFilter !== 'All Departments' ? departmentFilter : '—';
  const staffTypeName =
    staffTypeFilter === 'teaching'
      ? 'Teaching staff'
      : staffTypeFilter === 'non_teaching'
        ? 'Non-teaching staff'
        : 'All staff types';

  return {
    facultyName,
    departmentName,
    staffTypeName,
    academicYearName: selectedYear.label,
    selectedYearKey: selectedYear.key,
    recommendedCount,
    participantsCount,
    numberOfStaff: rows.length,
    yearKeys: displayYearKeys,
    years,
    rows,
    trainingImplementation,
    source: 'synced',
    syncedStaffCount,
    filterOptions: {
      faculties: ['All Faculties', ...allFaculties],
      departments: ['All Departments', ...departmentFilterOptions.allDepartments],
      departmentsByFaculty: departmentFilterOptions.departmentsByFaculty,
      staffTypes: [
        { value: 'all', label: 'All staff types' },
        { value: 'teaching', label: 'Teaching' },
        { value: 'non_teaching', label: 'Non-teaching' },
      ],
      academicYears: window.map((y) => ({ key: y.key, label: y.label })),
    },
  };
}

function normalizePwdFilter(value: string | null | undefined): DevelopmentPwdFilter {
  if (value === 'yes' || value === 'no' || value === 'not_recorded') return value;
  return 'all';
}

function normalizeStaffTypeFilter(value: string | null | undefined): StaffTypeFilter {
  if (value === 'teaching' || value === 'non_teaching') return value;
  return 'all';
}

export async function generateStaffDevelopmentReport(options: {
  faculty?: string | null;
  department?: string | null;
  staff_type?: string | null;
  pwd?: string | null;
  academic_year?: string | null;
}): Promise<StaffDevelopmentReport> {
  const window = getStaffDevelopmentAyWindow();
  const selectedYear = resolveSelectedYear(window, options.academic_year);
  const selectedYearKeys = [selectedYear.key];

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM users WHERE hrms_staff_id IS NOT NULL`,
    values: [],
  })) as { c: number }[];
  const syncedStaffCount = Number(countRows[0]?.c ?? 0);

  const devByUser = await loadDevelopmentEntries(window);
  const participantIds = [...devByUser.entries()]
    .filter(([, byYear]) => staffParticipatedInWindow(byYear, selectedYearKeys))
    .map(([userId]) => userId);

  const [filterRows, trainingImplementation, staffList] = await Promise.all([
    loadFilterOptions(selectedYearKeys, participantIds),
    loadTrainingImplementation([selectedYear]),
    loadActiveHrStaff(devByUser, selectedYearKeys),
  ]);

  const faculties = Array.from(new Set(filterRows.map((s) => s.faculty).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const departmentFilterOptions = buildDepartmentFilterOptions(filterRows);

  return buildStaffDevelopmentReport(
    staffList,
    options.faculty || null,
    options.department || null,
    normalizeStaffTypeFilter(options.staff_type),
    normalizePwdFilter(options.pwd),
    faculties,
    departmentFilterOptions,
    syncedStaffCount,
    window,
    selectedYear,
    trainingImplementation
  );
}
