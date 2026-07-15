import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

/** Create output under a standard (System Admin). */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const body = await request.json();
    const standardId = Number(body.standard_id);
    const serviceDescription = String(body.service_description || '').trim();
    if (!standardId || !serviceDescription) {
      return NextResponse.json({ message: 'standard_id and service_description required' }, { status: 400 });
    }

    const standards = (await query({
      query: 'SELECT id, code FROM sds_standards WHERE id = ?',
      values: [standardId],
    })) as { id: number; code: string }[];
    if (!standards.length) return NextResponse.json({ message: 'Standard not found' }, { status: 404 });

    let sequenceNo = Number(body.sequence_no);
    if (!Number.isFinite(sequenceNo) || sequenceNo <= 0) {
      const maxRows = (await query({
        query: 'SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM sds_outputs WHERE standard_id = ?',
        values: [standardId],
      })) as { max_seq: number }[];
      sequenceNo = Number(maxRows[0]?.max_seq || 0) + 1;
    }

    let outputCode = String(body.output_code || '').trim();
    if (!outputCode) {
      outputCode = `${standards[0].code}-O${String(sequenceNo).padStart(2, '0')}`;
    }

    const pis = Array.isArray(body.performance_indicators)
      ? body.performance_indicators.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    const result = (await query({
      query: `
        INSERT INTO sds_outputs
          (standard_id, output_code, sequence_no, service_description, performance_indicators_json,
           quality_standard, process_text, coverage, frequency, target_beneficiary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values: [
        standardId,
        outputCode,
        sequenceNo,
        serviceDescription,
        JSON.stringify(pis),
        String(body.quality_standard || '').trim() || null,
        String(body.process_text || '').trim() || null,
        String(body.coverage || '').trim() || null,
        String(body.frequency || '').trim() || null,
        String(body.target_beneficiary || '').trim() || null,
      ],
    })) as { insertId?: number };

    return NextResponse.json({
      id: Number(result.insertId || 0),
      output_code: outputCode,
      sequence_no: sequenceNo,
    }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Output code already exists' }, { status: 409 });
    }
    console.error('sds outputs POST', e);
    return NextResponse.json({ message: 'Error creating output' }, { status: 500 });
  }
}
