import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { assignStaffUserToSection, ensureDepartmentSectionTables } from '@/lib/department-sections';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';

type AuthContext = {
  userId: number;
  visibleDepartmentIds: number[];
};

type SectionRow = {
  id: number;
  department_id: number;
  name: string;
  head_user_id: number | null;
  head_name: string | null;
  staff_count: number | string;
};

type SectionStaffRow = {
  section_id: number;
  id: number;
  full_name: string;
  email: string;
  position: string | null;
};

type DbInsertResult = {
  insertId: number;
};

async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) return null;

  const visibleDepartmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (visibleDepartmentIds.length === 0) return null;

  return {
    userId: decoded.userId,
    visibleDepartmentIds,
  };
}

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureDepartmentSectionTables();

    const placeholders = inPlaceholders(ctx.visibleDepartmentIds.length);
    const sections = (await query({
      query: `
        SELECT 
          ds.id,
          ds.department_id,
          ds.name,
          ds.head_user_id,
          hu.full_name AS head_name,
          COUNT(dss.id) AS staff_count
        FROM department_sections ds
        LEFT JOIN users hu ON hu.id = ds.head_user_id
        LEFT JOIN department_section_staff dss ON dss.section_id = ds.id
        WHERE ds.department_id IN (${placeholders})
        GROUP BY ds.id, ds.department_id, ds.name, ds.head_user_id, hu.full_name
        ORDER BY ds.name ASC
      `,
      values: [...ctx.visibleDepartmentIds],
    })) as SectionRow[];

    const staffBySection = (await query({
      query: `
        SELECT 
          dss.section_id,
          u.id,
          u.full_name,
          u.email,
          u.position
        FROM department_section_staff dss
        JOIN department_sections ds ON ds.id = dss.section_id
        JOIN users u ON u.id = dss.staff_user_id
        WHERE ds.department_id IN (${placeholders})
        ORDER BY u.full_name ASC
      `,
      values: [...ctx.visibleDepartmentIds],
    })) as SectionStaffRow[];

    const grouped = new Map<number, Array<{ id: number; full_name: string; email: string; position: string | null }>>();
    for (const item of staffBySection) {
      const key = Number(item.section_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        id: item.id,
        full_name: item.full_name,
        email: item.email,
        position: item.position,
      });
    }

    const hodRows = (await query({
      query: 'SELECT department_id FROM users WHERE id = ?',
      values: [ctx.userId],
    })) as Array<{ department_id: number | null }>;
    const hodDepartmentId = hodRows[0]?.department_id ?? null;

    const departmentMeta = (await query({
      query: `
        SELECT id, name
        FROM departments
        WHERE id IN (${placeholders})
        ORDER BY name ASC
      `,
      values: [...ctx.visibleDepartmentIds],
    })) as Array<{ id: number; name: string }>;

    const defaultDepartmentId =
      hodDepartmentId != null && ctx.visibleDepartmentIds.includes(hodDepartmentId)
        ? hodDepartmentId
        : ctx.visibleDepartmentIds.length === 1
          ? ctx.visibleDepartmentIds[0]
          : (departmentMeta[0]?.id ?? ctx.visibleDepartmentIds[0] ?? null);

    return NextResponse.json({
      sections: sections.map((section) => ({
        ...section,
        staff_count: Number(section.staff_count || 0),
        staff: grouped.get(Number(section.id)) || [],
      })),
      department_options: departmentMeta,
      default_department_id: defaultDepartmentId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Department sections GET error:', error);
    return NextResponse.json({ message: 'Failed to load sections', detail: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureDepartmentSectionTables();

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const departmentId = Number(body?.department_id);
    const headUserIdRaw = body?.head_user_id;
    const headUserId = headUserIdRaw != null && headUserIdRaw !== '' ? Number(headUserIdRaw) : null;

    if (!name) return NextResponse.json({ message: 'Section name is required' }, { status: 400 });
    if (!Number.isFinite(departmentId) || !ctx.visibleDepartmentIds.includes(departmentId)) {
      return NextResponse.json({ message: 'Invalid department for this HOD' }, { status: 400 });
    }

    if (headUserId != null && Number.isFinite(headUserId)) {
      const userRows = (await query({
        query: `SELECT id FROM users WHERE id = ? AND department_id = ?`,
        values: [headUserId, departmentId],
      })) as Array<{ id: number }>;
      if (!userRows.length) {
        return NextResponse.json({ message: 'Selected section head must belong to the same department' }, { status: 400 });
      }
    }

    const result = await query({
      query: `
        INSERT INTO department_sections (department_id, name, head_user_id, created_by)
        VALUES (?, ?, ?, ?)
      `,
      values: [departmentId, name, headUserId, ctx.userId],
    });

    const newSectionId = (result as DbInsertResult).insertId;
    if (headUserId != null && Number.isFinite(headUserId) && newSectionId) {
      await assignStaffUserToSection({
        sectionId: newSectionId,
        staffUserId: headUserId,
        assignedByUserId: ctx.userId,
      });
    }

    return NextResponse.json(
      {
        message: 'Section created',
        id: newSectionId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const mysqlError = error as { code?: string };
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (mysqlError?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'A section with this name already exists in that department' }, { status: 409 });
    }
    console.error('Department sections POST error:', error);
    return NextResponse.json({ message: 'Failed to create section', detail: message }, { status: 500 });
  }
}
