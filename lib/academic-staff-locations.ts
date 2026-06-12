import { query } from '@/lib/db';

const SEPARATED_EMPLOYMENT = ['terminated', 'resigned', 'retired', 'deceased', 'dismissed'];

export type AcademicStaffLocation = {
  faculty: string;
  department: string;
};

export type AcademicStaffFilterOptions = {
  faculties: string[];
  departments: string[];
  departmentsByFaculty: Record<string, string[]>;
};

function isSeparatedEmployment(employmentStatus: string | null | undefined): boolean {
  const emp = (employmentStatus || '').toLowerCase();
  return SEPARATED_EMPLOYMENT.some((x) => emp.includes(x));
}

/** Active HR-synced academic staff mapped to faculty/office and department/unit. */
export async function loadAcademicStaffLocations(): Promise<AcademicStaffLocation[]> {
  const rows = (await query({
    query: `
      SELECT
        u.faculty_office,
        COALESCE(NULLIF(TRIM(d.external_name), ''), NULLIF(TRIM(d.name), '')) AS department,
        u.employment_status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND LOWER(TRIM(COALESCE(u.staff_category, ''))) = 'academic'
    `,
    values: [],
  })) as {
    faculty_office: string | null;
    department: string | null;
    employment_status: string | null;
  }[];

  return rows
    .filter((r) => !isSeparatedEmployment(r.employment_status))
    .map((r) => ({
      faculty: (r.faculty_office || '').trim(),
      department: (r.department || '').trim(),
    }))
    .filter((r) => r.faculty);
}

export function buildAcademicStaffFilterOptions(
  locations: AcademicStaffLocation[]
): AcademicStaffFilterOptions {
  const facultySet = new Set<string>();
  const departmentSet = new Set<string>();
  const byFaculty = new Map<string, Set<string>>();

  for (const loc of locations) {
    const faculty = loc.faculty.trim();
    const department = loc.department.trim();
    if (!faculty) continue;

    facultySet.add(faculty);
    if (department) {
      departmentSet.add(department);
      if (!byFaculty.has(faculty)) byFaculty.set(faculty, new Set());
      byFaculty.get(faculty)!.add(department);
    }
  }

  const sort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

  const departmentsByFaculty: Record<string, string[]> = {};
  for (const [faculty, depts] of byFaculty) {
    departmentsByFaculty[faculty] = Array.from(depts).sort(sort);
  }

  return {
    faculties: Array.from(facultySet).sort(sort),
    departments: Array.from(departmentSet).sort(sort),
    departmentsByFaculty,
  };
}

export async function listAcademicStaffFacultyOptions(): Promise<string[]> {
  const locations = await loadAcademicStaffLocations();
  return buildAcademicStaffFilterOptions(locations).faculties;
}
