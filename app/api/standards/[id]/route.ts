import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { buildPublicStandardDetail } from '@/lib/standards-api';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { insertStandardProcessRow, selectStandardProcessesForStandard } from '@/lib/standard-processes-db';
import { parseStandardProcessesPayload } from '@/lib/standard-processes-payload';
import {
  getDepartmentIdsForStandard,
  groupStandardDepartments,
  loadStandardDepartmentRows,
  parseDepartmentIdsPayload,
  setStandardDepartments,
} from '@/lib/standard-departments';
import {
  parseStandardSdsFromBody,
  selectStandardRowById,
  updateStandardRow,
  validateStandardWritePayload,
} from '@/lib/standards-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const standard = await selectStandardRowById(id);
    if (!standard) {
      return NextResponse.json({ message: 'Standard not found' }, { status: 404 });
    }

    const processes = await selectStandardProcessesForStandard(id);
    const departmentIds = await getDepartmentIdsForStandard(Number(id));
    const deptMap = groupStandardDepartments(await loadStandardDepartmentRows());
    const dept = deptMap.get(Number(id));

    return NextResponse.json(
      buildPublicStandardDetail(
        standard,
        processes,
        departmentIds,
        dept?.department_names ?? []
      )
    );
  } catch (error) {
    console.error('Error fetching standard:', error);
    return NextResponse.json({ message: 'Error fetching standard' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token) as { role?: string } | null;
    if (!decoded || !canManageStrategicStandards(decoded.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseStandardSdsFromBody(body);
    const validationError = validateStandardWritePayload(parsed);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const departmentIds = parseDepartmentIdsPayload(body.department_ids);
    if (departmentIds.length === 0) {
      return NextResponse.json({ message: 'Select at least one department or unit' }, { status: 400 });
    }

    await updateStandardRow(id, parsed);

    if (body.processes !== undefined) {
      await query({
        query: `DELETE FROM standard_processes WHERE standard_id = ?`,
        values: [id],
      });

      const processParsed = parseStandardProcessesPayload(body.processes);
      if (!processParsed.ok) {
        return NextResponse.json({ message: processParsed.message }, { status: 400 });
      }
      const sid = Number(id);
      for (let i = 0; i < processParsed.items.length; i++) {
        const row = processParsed.items[i];
        await insertStandardProcessRow(
          sid,
          row.stepName,
          i,
          row.durationValue,
          row.durationUnit,
          row.milestoneProgress ??
            (processParsed.items.length > 1 ? Math.round(((i + 1) / processParsed.items.length) * 100) : 100)
        );
      }
    }

    await setStandardDepartments(Number(id), departmentIds);

    return NextResponse.json({ message: 'Standard updated' });
  } catch (error) {
    console.error('Error updating standard:', error);
    return NextResponse.json({ message: 'Error updating standard' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token) as { role?: string } | null;
    if (!decoded || !canManageStrategicStandards(decoded.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await query({
      query: `DELETE FROM standards WHERE id = ?`,
      values: [id],
    });

    return NextResponse.json({ message: 'Standard deleted' });
  } catch (error) {
    console.error('Error deleting standard:', error);
    return NextResponse.json({ message: 'Error deleting standard' }, { status: 500 });
  }
}
