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

type SectionRow = {
  id: number;
  department_id: number;
  name: string;
  head_user_id: number | null;
};

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureDepartmentSectionTables();

    const params = await context.params;
    const sectionId = Number(params.id);
    if (!Number.isFinite(sectionId) || sectionId <= 0) {
      return NextResponse.json({ message: 'Invalid section id' }, { status: 400 });
    }

    const placeholders = inPlaceholders(ctx.visibleDepartmentIds.length);
    const rows = (await query({
      query: `
        SELECT id, department_id, name, head_user_id
        FROM department_sections
        WHERE id = ? AND department_id IN (${placeholders})
      `,
      values: [sectionId, ...ctx.visibleDepartmentIds],
    })) as SectionRow[];

    if (!rows.length) {
      return NextResponse.json({ message: 'Section not found or not accessible' }, { status: 404 });
    }

    const existing = rows[0];
    const deptId = existing.department_id;

    const body = (await request.json()) as Record<string, unknown>;
    const rawName = body.name;
    const rawHead = 'head_user_id' in body ? body.head_user_id : undefined;

    const name =
      typeof rawName === 'string'
        ? rawName.trim()
        : typeof rawName === 'number'
          ? String(rawName).trim()
          : existing.name;

    if (!name) {
      return NextResponse.json({ message: 'Section name cannot be empty' }, { status: 400 });
    }

    let headUserId: number | null = existing.head_user_id;
    if (rawHead !== undefined) {
      if (rawHead === null || rawHead === '') {
        headUserId = null;
      } else {
        const hid = Number(rawHead);
        if (!Number.isFinite(hid)) {
          return NextResponse.json({ message: 'Invalid section head' }, { status: 400 });
        }
        const ok = (await query({
          query: `SELECT id FROM users WHERE id = ? AND department_id = ?`,
          values: [hid, deptId],
        })) as Array<{ id: number }>;
        if (!ok.length) {
          return NextResponse.json({ message: 'Section head must belong to the same department as the section' }, { status: 400 });
        }
        headUserId = hid;
      }
    }

    await query({
      query: `
        UPDATE department_sections
        SET name = ?, head_user_id = ?
        WHERE id = ? AND department_id IN (${placeholders})
      `,
      values: [name, headUserId, sectionId, ...ctx.visibleDepartmentIds],
    });

    if (headUserId != null && Number.isFinite(headUserId)) {
      await assignStaffUserToSection({
        sectionId,
        staffUserId: headUserId,
        assignedByUserId: ctx.userId,
      });
    }

    return NextResponse.json({ message: 'Section updated', id: sectionId });
  } catch (error: unknown) {
    const mysqlError = error as { code?: string };
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (mysqlError?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'A section with this name already exists in this department' }, { status: 409 });
    }
    console.error('Department section PUT error:', error);
    return NextResponse.json({ message: 'Failed to update section', detail: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await ensureDepartmentSectionTables();

    const params = await context.params;
    const sectionId = Number(params.id);
    if (!Number.isFinite(sectionId) || sectionId <= 0) {
      return NextResponse.json({ message: 'Invalid section id' }, { status: 400 });
    }

    const placeholders = inPlaceholders(ctx.visibleDepartmentIds.length);

    const exists = (await query({
      query: `
        SELECT id FROM department_sections
        WHERE id = ? AND department_id IN (${placeholders})
      `,
      values: [sectionId, ...ctx.visibleDepartmentIds],
    })) as Array<{ id: number }>;

    if (!exists.length) {
      return NextResponse.json({ message: 'Section not found or not accessible' }, { status: 404 });
    }

    await query({
      query: `DELETE FROM department_section_staff WHERE section_id = ?`,
      values: [sectionId],
    });

    await query({
      query: `
        DELETE FROM department_sections
        WHERE id = ? AND department_id IN (${placeholders})
      `,
      values: [sectionId, ...ctx.visibleDepartmentIds],
    });

    return NextResponse.json({ message: 'Section deleted', id: sectionId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Department section DELETE error:', error);
    return NextResponse.json({ message: 'Failed to delete section', detail: message }, { status: 500 });
  }
}
