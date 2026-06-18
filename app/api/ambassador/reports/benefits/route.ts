import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHrAmbassador } from '@/lib/ambassador/hr-unit';
import { isSyncedStaff } from '@/lib/ambassador/faculty-staff';
import { BENEFIT_TYPES, type BenefitType } from '@/lib/hrms/staff-benefits';
import { labelsFromFyWindow, getPastFinancialYearWindow } from '@/lib/financial-year';

const BENEFIT_LABELS = Object.fromEntries(BENEFIT_TYPES.map((b) => [b.value, b.label])) as Record<BenefitType, string>;

function yearLabel(key: string) {
  const years = labelsFromFyWindow(getPastFinancialYearWindow(5));
  return years[key] ?? key;
}

export async function GET() {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const rows = (await query({
    query: `
      SELECT e.id, e.user_id, e.financial_year_key, e.benefit_type, e.received,
             e.created_at, e.updated_at,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS staff_name,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name, '') AS department_name
      FROM staff_benefit_entries e
      INNER JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY e.updated_at DESC, e.id DESC
    `,
    values: [],
  })) as {
    id: number;
    user_id: number;
    financial_year_key: string;
    benefit_type: BenefitType;
    received: number;
    created_at: string;
    updated_at: string;
    staff_name: string;
    department_name: string;
  }[];

  return NextResponse.json({
    records: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      staffName: (r.staff_name || '').trim() || `Staff #${r.user_id}`,
      departmentName: r.department_name || '—',
      financialYearKey: r.financial_year_key,
      financialYearLabel: yearLabel(r.financial_year_key),
      benefitType: r.benefit_type,
      benefitLabel: BENEFIT_LABELS[r.benefit_type] ?? r.benefit_type,
      received: Boolean(r.received),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireHrAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const userId = Number(body.userId);
  const financialYearKey = String(body.financialYearKey || '').trim();
  const benefitType = String(body.benefitType || '').trim() as BenefitType;
  const received = body.received !== false ? 1 : 0;

  if (!userId || !financialYearKey || !benefitType) {
    return NextResponse.json({ message: 'Staff, financial year, and benefit type are required' }, { status: 400 });
  }

  if (!BENEFIT_LABELS[benefitType]) {
    return NextResponse.json({ message: 'Invalid benefit type' }, { status: 400 });
  }

  const synced = await isSyncedStaff(userId);
  if (!synced) {
    return NextResponse.json({ message: 'Staff member is not HR-synced in M&E' }, { status: 403 });
  }

  try {
    const result = (await query({
      query: `
        INSERT INTO staff_benefit_entries (user_id, financial_year_key, benefit_type, received)
        VALUES (?, ?, ?, ?)
      `,
      values: [userId, financialYearKey, benefitType, received],
    })) as { insertId: number };

    return NextResponse.json({ id: result.insertId, message: 'Benefit entry saved' }, { status: 201 });
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
