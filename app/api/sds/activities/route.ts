import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import { durationTextToDays } from '@/lib/sds/codes';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

/** Create a process activity under an output (System Admin / Strategy Manager). */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const body = await request.json();
    const outputId = Number(body.output_id);
    const activityName = String(body.activity_name || '').trim();
    const durationText = String(body.duration_text || '').trim() || null;
    let sequenceNo = Number(body.sequence_no);

    if (!outputId || !activityName) {
      return NextResponse.json({ message: 'output_id and activity_name required' }, { status: 400 });
    }

    const outs = (await query({
      query: 'SELECT id FROM sds_outputs WHERE id = ?',
      values: [outputId],
    })) as { id: number }[];
    if (!outs.length) return NextResponse.json({ message: 'Output not found' }, { status: 404 });

    if (!Number.isFinite(sequenceNo) || sequenceNo <= 0) {
      const maxRows = (await query({
        query: 'SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM sds_activities WHERE output_id = ?',
        values: [outputId],
      })) as { max_seq: number }[];
      sequenceNo = Number(maxRows[0]?.max_seq || 0) + 1;
    }

    const result = (await query({
      query: `
        INSERT INTO sds_activities (output_id, sequence_no, activity_name, duration_text, duration_days)
        VALUES (?, ?, ?, ?, ?)
      `,
      values: [outputId, sequenceNo, activityName, durationText, durationTextToDays(durationText)],
    })) as { insertId?: number };

    return NextResponse.json({
      id: Number(result.insertId || 0),
      output_id: outputId,
      sequence_no: sequenceNo,
      activity_name: activityName,
      duration_text: durationText,
      duration_days: durationTextToDays(durationText),
    }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Sequence already exists for this output' }, { status: 409 });
    }
    console.error('sds activities POST', e);
    return NextResponse.json({ message: 'Error creating activity' }, { status: 500 });
  }
}
