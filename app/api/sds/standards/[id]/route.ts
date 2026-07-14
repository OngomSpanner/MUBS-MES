import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import { parseSdsStandardCode } from '@/lib/sds/codes';

export const dynamic = 'force-dynamic';

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token) as { userId?: number; role?: string } | null;
}

async function requireAdmin() {
  const decoded = await requireAuth();
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

function parseJsonArray(raw: unknown): string[] {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    /* noop */
  }
  return [];
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAuth())) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureSdsSchema();
    const { id } = await context.params;
    const standardId = Number(id);
    if (!Number.isFinite(standardId) || standardId <= 0) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    const standards = (await query({
      query: `
        SELECT s.*,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS owner_department_name
        FROM sds_standards s
        LEFT JOIN departments d ON d.id = s.owner_department_id
        WHERE s.id = ?
      `,
      values: [standardId],
    })) as Record<string, unknown>[];
    if (!standards.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const outputs = (await query({
      query: `
        SELECT * FROM sds_outputs
        WHERE standard_id = ?
        ORDER BY sequence_no ASC, id ASC
      `,
      values: [standardId],
    })) as Record<string, unknown>[];

    const outputIds = outputs.map((o) => Number(o.id));
    let activities: Record<string, unknown>[] = [];
    if (outputIds.length) {
      const placeholders = outputIds.map(() => '?').join(',');
      activities = (await query({
        query: `
          SELECT * FROM sds_activities
          WHERE output_id IN (${placeholders})
          ORDER BY output_id ASC, sequence_no ASC, id ASC
        `,
        values: outputIds,
      })) as Record<string, unknown>[];
    }

    const byOutput = new Map<number, Record<string, unknown>[]>();
    for (const a of activities) {
      const oid = Number(a.output_id);
      const list = byOutput.get(oid) ?? [];
      list.push({
        ...a,
        id: Number(a.id),
        output_id: oid,
        sequence_no: Number(a.sequence_no),
        duration_days: a.duration_days != null ? Number(a.duration_days) : null,
      });
      byOutput.set(oid, list);
    }

    const s = standards[0];
    return NextResponse.json({
      ...s,
      id: Number(s.id),
      owner_department_id: s.owner_department_id != null ? Number(s.owner_department_id) : null,
      objectives: parseJsonArray(s.objectives_json),
      outputs: outputs.map((o) => ({
        ...o,
        id: Number(o.id),
        standard_id: Number(o.standard_id),
        sequence_no: Number(o.sequence_no),
        performance_indicators: parseJsonArray(o.performance_indicators_json),
        activities: byOutput.get(Number(o.id)) ?? [],
      })),
    });
  } catch (e) {
    console.error('sds standards GET id', e);
    return NextResponse.json({ message: 'Error loading SDS standard' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const { id } = await context.params;
    const standardId = Number(id);
    const body = await request.json();

    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ message: 'title is required' }, { status: 400 });

    const codeRaw = String(body.code || '').trim();
    const parsed = codeRaw ? parseSdsStandardCode(codeRaw) : null;
    const ownerDepartmentId = Number(body.owner_department_id);
    const objectives = Array.isArray(body.objectives)
      ? body.objectives.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    await query({
      query: `
        UPDATE sds_standards SET
          code = COALESCE(?, code),
          title = ?,
          owner_department_id = ?,
          owner_label = ?,
          supporting_units = ?,
          pathway = ?,
          user_fee = ?,
          purpose = ?,
          objectives_json = ?,
          pillar = ?,
          owner_code = COALESCE(?, owner_code)
        WHERE id = ?
      `,
      values: [
        parsed?.normalized || null,
        title,
        Number.isFinite(ownerDepartmentId) && ownerDepartmentId > 0 ? ownerDepartmentId : null,
        String(body.owner_label || '').trim() || null,
        String(body.supporting_units || '').trim() || null,
        String(body.pathway || '').trim() || null,
        String(body.user_fee || '').trim() || null,
        String(body.purpose || '').trim() || null,
        JSON.stringify(objectives),
        String(body.pillar || '').trim() || parsed?.pillar || null,
        parsed?.ownerAbbrev || null,
        standardId,
      ],
    });

    // Optional nested outputs upsert (admin full edit)
    if (Array.isArray(body.outputs)) {
      for (const [idx, raw] of body.outputs.entries()) {
        const o = raw as Record<string, unknown>;
        const outputId = Number(o.id);
        const serviceDescription = String(o.service_description || '').trim();
        if (!serviceDescription) continue;
        const pis = Array.isArray(o.performance_indicators)
          ? o.performance_indicators.map((x) => String(x).trim()).filter(Boolean)
          : [];

        if (Number.isFinite(outputId) && outputId > 0) {
          await query({
            query: `
              UPDATE sds_outputs SET
                sequence_no = ?, service_description = ?, performance_indicators_json = ?,
                quality_standard = ?, access_standard = ?, coverage = ?, frequency = ?,
                process_text = ?, target_beneficiary = ?, access_criteria = ?, methodology = ?, inputs = ?
              WHERE id = ? AND standard_id = ?
            `,
            values: [
              Number(o.sequence_no) || idx + 1,
              serviceDescription,
              JSON.stringify(pis),
              String(o.quality_standard || '').trim() || null,
              String(o.access_standard || '').trim() || null,
              String(o.coverage || '').trim() || null,
              String(o.frequency || '').trim() || null,
              String(o.process_text || '').trim() || null,
              String(o.target_beneficiary || '').trim() || null,
              String(o.access_criteria || '').trim() || null,
              String(o.methodology || '').trim() || null,
              String(o.inputs || '').trim() || null,
              outputId,
              standardId,
            ],
          });
        }
      }
    }

    return NextResponse.json({ message: 'Updated' });
  } catch (e) {
    console.error('sds standards PUT', e);
    return NextResponse.json({ message: 'Error updating SDS standard' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const { id } = await context.params;
    const standardId = Number(id);
    // Soft-delete preferred for safety
    await query({
      query: 'UPDATE sds_standards SET is_active = 0 WHERE id = ?',
      values: [standardId],
    });
    return NextResponse.json({ message: 'Deactivated' });
  } catch (e) {
    console.error('sds standards DELETE', e);
    return NextResponse.json({ message: 'Error deleting SDS standard' }, { status: 500 });
  }
}
