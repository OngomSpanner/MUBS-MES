import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';
import type { StaffProfileData } from '@/lib/staff-biodata';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';

export type FacultyStaffProfileRow = StaffProfileData & {
  department: string;
};

function parseSectionsConcat(raw: string | null | undefined): Array<{ id: number; name: string }> {
  if (!raw) return [];
  return raw
    .split('||')
    .map((part) => {
      const [idStr, name] = part.split(':');
      const id = Number(idStr);
      if (!Number.isFinite(id) || !name) return null;
      return { id, name: name.trim() };
    })
    .filter((s): s is { id: number; name: string } => s !== null);
}

/** All HR-synced staff under the ambassador's faculty/office (by department tree). */
export async function listFacultyStaffProfiles(
  managedUnitId: number
): Promise<FacultyStaffProfileRow[]> {
  const departmentIds = await getManagedUnitDepartmentIds(managedUnitId);
  if (departmentIds.length === 0) return [];

  const placeholders = inPlaceholders(departmentIds.length);

  const rows = (await query({
    query: `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.position,
        COALESCE(u.leave_status, 'On Duty') AS leave_status,
        COALESCE(u.contract_end_date, u.contract_end) AS contract_end_date,
        u.employment_status,
        u.contract_type,
        u.staff_category,
        COALESCE(u.contract_start_date, u.contract_start) AS contract_start_date,
        u.status AS account_status,
        u.gender,
        u.nationality,
        u.designation_grade,
        DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
        DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
        DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
        DATE_FORMAT(u.date_office_assignment, '%Y-%m-%d') AS date_office_assignment,
        DATE_FORMAT(u.retirement_date, '%Y-%m-%d') AS retirement_date,
        u.disability_status,
        u.disability_type,
        u.workplace_accommodation,
        u.special_support_needs,
        u.faculty_office,
        COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department,
        GROUP_CONCAT(DISTINCT CONCAT(ds.id, ':', ds.name) ORDER BY ds.name SEPARATOR '||') AS sections_concat,
        (
          (
            SELECT COUNT(*) FROM activity_assignments aa_cnt
            WHERE aa_cnt.assigned_to_user_id = u.id
            AND LOWER(TRIM(COALESCE(aa_cnt.status, ''))) NOT IN ('completed', 'evaluated', 'not_done')
          )
          + (
            SELECT COUNT(*) FROM staff_process_assignments spa_cnt
            WHERE spa_cnt.staff_id = u.id
            AND LOWER(TRIM(COALESCE(spa_cnt.status, ''))) NOT IN ('evaluated', 'completed', 'not_done')
          )
        ) AS active_tasks
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN department_section_staff dss ON dss.staff_user_id = u.id
      LEFT JOIN department_sections ds ON ds.id = dss.section_id
      WHERE u.hrms_staff_id IS NOT NULL
        AND u.department_id IN (${placeholders})
      GROUP BY
        u.id,
        u.full_name,
        u.email,
        u.position,
        leave_status,
        contract_end_date,
        u.employment_status,
        u.contract_type,
        u.staff_category,
        contract_start_date,
        account_status,
        u.gender,
        u.nationality,
        u.designation_grade,
        date_of_birth,
        date_first_appointment,
        date_current_appointment,
        date_office_assignment,
        retirement_date,
        u.disability_status,
        u.disability_type,
        u.workplace_accommodation,
        u.special_support_needs,
        u.faculty_office,
        department
      ORDER BY u.full_name ASC
    `,
    values: departmentIds,
  })) as Array<{
    id: number;
    full_name: string;
    email: string;
    position: string | null;
    leave_status: string;
    contract_end_date: string | null;
    employment_status: string | null;
    contract_type: string | null;
    staff_category: string | null;
    contract_start_date: string | null;
    account_status: string | null;
    gender: string | null;
    nationality: string | null;
    designation_grade: string | null;
    date_of_birth: string | null;
    date_first_appointment: string | null;
    date_current_appointment: string | null;
    date_office_assignment: string | null;
    retirement_date: string | null;
    disability_status: string | null;
    disability_type: string | null;
    workplace_accommodation: string | null;
    special_support_needs: string | null;
    faculty_office: string | null;
    department: string;
    sections_concat: string | null;
    active_tasks: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    full_name: (r.full_name || '').trim() || `Staff #${r.id}`,
    email: r.email || '—',
    position: r.position,
    leave_status: r.leave_status,
    contract_end_date: r.contract_end_date,
    employment_status: r.employment_status,
    contract_type: r.contract_type,
    staff_category: r.staff_category,
    contract_start_date: r.contract_start_date,
    account_status: r.account_status,
    gender: r.gender,
    nationality: r.nationality,
    designation_grade: r.designation_grade,
    date_of_birth: r.date_of_birth,
    date_first_appointment: r.date_first_appointment,
    date_current_appointment: r.date_current_appointment,
    date_office_assignment: r.date_office_assignment,
    retirement_date: r.retirement_date,
    disability_status: r.disability_status,
    disability_type: r.disability_type,
    workplace_accommodation: r.workplace_accommodation,
    special_support_needs: r.special_support_needs,
    faculty_office: r.faculty_office,
    department: r.department || '—',
    sections: parseSectionsConcat(r.sections_concat),
    active_tasks: Number(r.active_tasks || 0),
  }));
}
