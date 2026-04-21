import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { ensureDepartmentSectionTables } from '@/lib/department-sections';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

type SectionRow = {
  id: number;
  department_id: number;
};

type UserIdRow = {
  id: number;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded?.userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureDepartmentSectionTables();

    const visibleDepartmentIds = await getVisibleDepartmentIds(decoded.userId);
    if (!visibleDepartmentIds.length) {
      return NextResponse.json({ message: 'No visible departments for this user' }, { status: 403 });
    }

    const params = await context.params;
    const sectionId = Number(params.id);
    if (!Number.isFinite(sectionId)) {
      return NextResponse.json({ message: 'Invalid section id' }, { status: 400 });
    }

    const body = await request.json();
    const incoming = Array.isArray(body?.staff_ids) ? body.staff_ids : [];
    const staffIds = incoming
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const placeholders = inPlaceholders(visibleDepartmentIds.length);
    const sectionRows = (await query({
      query: `
        SELECT id, department_id
        FROM department_sections
        WHERE id = ? AND department_id IN (${placeholders})
      `,
      values: [sectionId, ...visibleDepartmentIds],
    })) as SectionRow[];

    if (!sectionRows.length) {
      return NextResponse.json({ message: 'Section not found or not accessible' }, { status: 404 });
    }

    const sectionDepartmentId = Number(sectionRows[0].department_id);

    const headRows = (await query({
      query: `SELECT head_user_id FROM department_sections WHERE id = ?`,
      values: [sectionId],
    })) as Array<{ head_user_id: number | null }>;
    const sectionHeadId = headRows[0]?.head_user_id ?? null;

    let validStaffIds: number[] = [];
    if (staffIds.length > 0) {
      const staffPlaceholders = inPlaceholders(staffIds.length);
      const validRows = (await query({
        query: `
          SELECT id
          FROM users
          WHERE id IN (${staffPlaceholders}) AND department_id = ?
        `,
        values: [...staffIds, sectionDepartmentId],
      })) as UserIdRow[];
      validStaffIds = validRows.map((row) => Number(row.id));
    }

    if (sectionHeadId != null && Number.isFinite(sectionHeadId)) {
      const headOk = (await query({
        query: `SELECT id FROM users WHERE id = ? AND department_id = ?`,
        values: [sectionHeadId, sectionDepartmentId],
      })) as UserIdRow[];
      if (headOk.length > 0) {
        validStaffIds = [...new Set([...validStaffIds, sectionHeadId])];
      }
    }

    await query({
      query: `
        DELETE dss
        FROM department_section_staff dss
        JOIN users u ON u.id = dss.staff_user_id
        WHERE dss.section_id = ? AND u.department_id = ?
      `,
      values: [sectionId, sectionDepartmentId],
    });

    if (validStaffIds.length > 0) {
      const clearPlaceholders = inPlaceholders(validStaffIds.length);
      await query({
        query: `
          DELETE FROM department_section_staff
          WHERE staff_user_id IN (${clearPlaceholders})
        `,
        values: [...validStaffIds],
      });

      for (const staffId of validStaffIds) {
        await query({
          query: `
            INSERT INTO department_section_staff (section_id, staff_user_id, assigned_by)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
              section_id = VALUES(section_id),
              assigned_by = VALUES(assigned_by),
              assigned_at = CURRENT_TIMESTAMP
          `,
          values: [sectionId, staffId, decoded.userId],
        });
      }
    }

    return NextResponse.json({
      message: 'Section staff updated',
      assigned: validStaffIds.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Section staff assignment error:', error);
    return NextResponse.json({ message: 'Failed to update section staff', detail: message }, { status: 500 });
  }
}
