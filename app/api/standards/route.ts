import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { buildPublicStandardsList } from '@/lib/standards-api';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { insertStandardProcessRow, selectStandardProcessesAll } from '@/lib/standard-processes-db';
import { parseStandardProcessesPayload } from '@/lib/standard-processes-payload';
import {
  groupStandardDepartments,
  loadStandardDepartmentRows,
  parseDepartmentIdsPayload,
  setStandardDepartments,
} from '@/lib/standard-departments';
import {
  insertStandardRow,
  parseStandardSdsFromBody,
  selectAllStandardsRows,
  validateStandardWritePayload,
} from '@/lib/standards-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const standards = await selectAllStandardsRows();
    const processes = await selectStandardProcessesAll();
    const deptRows = await loadStandardDepartmentRows();
    const departmentMap = groupStandardDepartments(deptRows);

    return NextResponse.json(buildPublicStandardsList(standards, processes, departmentMap));
  } catch (error) {
    console.error('Error fetching standards:', error);
    return NextResponse.json({ message: 'Error fetching standards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const processParsed = parseStandardProcessesPayload(body.processes);
    if (!processParsed.ok) {
      return NextResponse.json({ message: processParsed.message }, { status: 400 });
    }

    const { insertId: standardId } = await insertStandardRow(parsed);

    for (let i = 0; i < processParsed.items.length; i++) {
      const row = processParsed.items[i];
      await insertStandardProcessRow(
        standardId,
        row.stepName,
        i,
        row.durationValue,
        row.durationUnit,
        row.milestoneProgress ??
          (processParsed.items.length > 1 ? Math.round(((i + 1) / processParsed.items.length) * 100) : 100)
      );
    }

    await setStandardDepartments(standardId, departmentIds);

    return NextResponse.json({ message: 'Standard created', id: standardId }, { status: 201 });
  } catch (error) {
    console.error('Error creating standard:', error);
    return NextResponse.json({ message: 'Error creating standard' }, { status: 500 });
  }
}
