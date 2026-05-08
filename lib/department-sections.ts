import { query } from '@/lib/db';

let ensured = false;

export async function ensureDepartmentSectionTables(): Promise<void> {
  if (ensured) return;

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS department_sections (
        id INT PRIMARY KEY AUTO_INCREMENT,
        department_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        head_user_id INT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_department_section_name (department_id, name),
        KEY idx_department_sections_department_id (department_id),
        KEY idx_department_sections_head_user_id (head_user_id)
      )
    `,
  });

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS department_section_staff (
        id INT PRIMARY KEY AUTO_INCREMENT,
        section_id INT NOT NULL,
        staff_user_id INT NOT NULL,
        assigned_by INT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_section_staff (section_id, staff_user_id),
        KEY idx_section_staff_section_id (section_id)
      )
    `,
  });

  // Migration: allow a staff member to belong to multiple sections.
  // Older installs had a UNIQUE index on staff_user_id which forced one section per staff.
  try {
    const idxRows = (await query({
      query: `
        SELECT INDEX_NAME AS index_name
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'department_section_staff'
          AND INDEX_NAME = 'uniq_staff_single_section'
        LIMIT 1
      `,
    })) as Array<{ index_name: string }>;

    if (idxRows.length > 0) {
      await query({ query: `ALTER TABLE department_section_staff DROP INDEX uniq_staff_single_section` });
    }
  } catch {
    // Ignore: if permissions/table state prevent INFORMATION_SCHEMA checks, the app can still run.
  }

  ensured = true;
}

/** Adds this user to the section’s team (does not remove other section memberships). */
export async function assignStaffUserToSection(options: {
  sectionId: number;
  staffUserId: number;
  assignedByUserId: number;
}): Promise<void> {
  await ensureDepartmentSectionTables();
  await query({
    query: `
      INSERT INTO department_section_staff (section_id, staff_user_id, assigned_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        assigned_by = VALUES(assigned_by),
        assigned_at = CURRENT_TIMESTAMP
    `,
    values: [options.sectionId, options.staffUserId, options.assignedByUserId],
  });
}

/** True if user is this section’s head or a member of department_section_staff for it. Section must belong to one of visibleDepartmentIds. */
export async function staffBelongsToDepartmentSection(
  sectionId: number,
  staffUserId: number,
  visibleDepartmentIds: number[]
): Promise<boolean> {
  if (!visibleDepartmentIds.length) return false;
  await ensureDepartmentSectionTables();
  const placeholders = visibleDepartmentIds.map(() => '?').join(',');
  const secRows = (await query({
    query: `
      SELECT id, head_user_id
      FROM department_sections
      WHERE id = ? AND department_id IN (${placeholders})
    `,
    values: [sectionId, ...visibleDepartmentIds],
  })) as Array<{ id: number; head_user_id: number | null }>;
  if (!secRows.length) return false;
  const headId = secRows[0].head_user_id;
  if (headId != null && Number(headId) === Number(staffUserId)) return true;

  const member = (await query({
    query: `
      SELECT 1 FROM department_section_staff
      WHERE section_id = ? AND staff_user_id = ?
      LIMIT 1
    `,
    values: [sectionId, staffUserId],
  })) as unknown[];
  return member.length > 0;
}
