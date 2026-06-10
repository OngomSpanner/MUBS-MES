import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador } from '@/lib/ambassador/context';
import { isStaffInFaculty } from '@/lib/ambassador/faculty-staff';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';
import { inPlaceholders } from '@/lib/department-head';
import { BENEFIT_TYPES, type BenefitType } from '@/lib/hrms/staff-benefits';

const VALID_TYPES = new Set(BENEFIT_TYPES.map((b) => b.value));

async function getOwnedEntry(id: number, departmentIds: number[]) {
  if (departmentIds.length === 0) return null;
  const deptPlaceholders = inPlaceholders(departmentIds.length);
  const rows = (await query({
    query: `
      SELECT e.id, e.user_id, e.financial_year_key, e.benefit_type, e.received
      FROM staff_benefit_entries e
      INNER JOIN users u ON u.id = e.user_id
      WHERE e.id = ?
        AND u.department_id IN (${deptPlaceholders})
      LIMIT 1
    `,
    values: [id, ...departmentIds],
  })) as { id: number; user_id: number; financial_year_key: string; benefit_type: BenefitType; received: number }[];
  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const departmentIds = await getManagedUnitDepartmentIds(auth.managedUnitId);
  const existing = await getOwnedEntry(id, departmentIds);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const body = await request.json();
  const userId = body.userId != null ? Number(body.userId) : existing.user_id;
  const financialYearKey = body.financialYearKey != null ? String(body.financialYearKey).trim() : existing.financial_year_key;
  const benefitType = (body.benefitType != null ? String(body.benefitType).trim() : existing.benefit_type) as BenefitType;
  const received = body.received !== undefined ? (body.received !== false ? 1 : 0) : existing.received;

  if (!VALID_TYPES.has(benefitType)) {
    return NextResponse.json({ message: 'Invalid benefit type' }, { status: 400 });
  }

  const inFaculty = await isStaffInFaculty(userId, auth.managedUnitId, auth.managedUnitName);
  if (!inFaculty) {
    return NextResponse.json({ message: 'Staff member is not in your department or unit' }, { status: 403 });
  }

  try {
    await query({
      query: `
        UPDATE staff_benefit_entries
        SET user_id = ?, financial_year_key = ?, benefit_type = ?, received = ?
        WHERE id = ?
      `,
      values: [userId, financialYearKey, benefitType, received, id],
    });
    return NextResponse.json({ message: 'Benefit entry updated' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_staff_benefit')) {
      return NextResponse.json(
        { message: 'This staff member already has this benefit recorded for that year' },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  const departmentIds = await getManagedUnitDepartmentIds(auth.managedUnitId);
  const existing = await getOwnedEntry(id, departmentIds);
  if (!existing) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  await query({ query: 'DELETE FROM staff_benefit_entries WHERE id = ?', values: [id] });
  return NextResponse.json({ message: 'Benefit entry deleted' });
}
