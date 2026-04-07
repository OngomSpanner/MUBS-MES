import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { buildPublicStandardDetail } from '@/lib/standards-api';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { insertStandardProcessRow, selectStandardProcessesForStandard } from '@/lib/standard-processes-db';
import { parseStandardProcessesPayload } from '@/lib/standard-processes-payload';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let standard: Record<string, unknown>[];
    try {
      standard = (await query({
        query: `SELECT id, title, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, target, created_at FROM standards WHERE id = ?`,
        values: [id],
      })) as Record<string, unknown>[];
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        try {
          standard = (await query({
            query: `SELECT id, title, quality_standard, output_standard, performance_indicator, target, created_at FROM standards WHERE id = ?`,
            values: [id],
          })) as Record<string, unknown>[];
          standard = standard.map((s) => ({ ...s, duration_value: null, duration_unit: null }));
        } catch (e2: unknown) {
          const err2 = e2 as { code?: string; errno?: number };
          if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
            standard = (await query({
              query: `SELECT id, title, quality_standard, output_standard, duration_value, duration_unit, target, created_at FROM standards WHERE id = ?`,
              values: [id],
            })) as Record<string, unknown>[];
            standard = standard.map((s) => ({ ...s, performance_indicator: null }));
          } else {
            standard = (await query({
              query: `SELECT id, title, quality_standard, output_standard, target, created_at FROM standards WHERE id = ?`,
              values: [id],
            })) as Record<string, unknown>[];
            standard = standard.map((s) => ({ ...s, performance_indicator: null, duration_value: null, duration_unit: null }));
          }
        }
      } else {
        throw e;
      }
    }

    if (standard.length === 0) {
      return NextResponse.json({ message: 'Standard not found' }, { status: 404 });
    }

    const processes = await selectStandardProcessesForStandard(id);

    return NextResponse.json(buildPublicStandardDetail(standard[0], processes));
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
    const { title: rawTitle, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, processes } = body;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title) return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    const quality = typeof quality_standard === 'string' ? quality_standard.trim() : '';
    const output = typeof output_standard === 'string' ? output_standard.trim() : '';
    const pi = typeof performance_indicator === 'string' ? performance_indicator.trim() : '';
    if (!quality) return NextResponse.json({ message: 'Quality standard is required' }, { status: 400 });
    if (!output) return NextResponse.json({ message: 'Output standard is required' }, { status: 400 });
    const unit = typeof duration_unit === 'string' ? duration_unit.trim().toLowerCase() : '';
    const dvNum = duration_value != null && duration_value !== '' ? parseInt(String(duration_value), 10) : null;

    const coreValues = [
      title, 
      quality, 
      output, 
      pi || null, 
      dvNum, 
      unit, 
      null, 
      id
    ];
    try {
      if (!unit) return NextResponse.json({ message: 'Duration unit is required' }, { status: 400 });
      if (dvNum == null || !Number.isFinite(dvNum) || dvNum < 1) {
        return NextResponse.json({ message: 'Duration value must be at least 1' }, { status: 400 });
      }
      await query({
        query: `UPDATE standards SET 
        title = ?, quality_standard = ?, output_standard = ?, performance_indicator = ?, duration_value = ?, duration_unit = ?, target = ?
        WHERE id = ?`,
        values: coreValues,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        // Try schema with performance_indicator only
        try {
          await query({
            query: `UPDATE standards SET title = ?, quality_standard = ?, output_standard = ?, performance_indicator = ?, target = ? WHERE id = ?`,
            values: [title, quality, output, pi || null, null, id],
          });
        } catch (e2: unknown) {
          const err2 = e2 as { code?: string; errno?: number };
          if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
            // Oldest schema
            await query({
              query: `UPDATE standards SET title = ?, quality_standard = ?, output_standard = ?, target = ? WHERE id = ?`,
              values: [title, quality, output, null, id],
            });
          } else {
            throw e2;
          }
        }
      } else {
        throw e;
      }
    }

    // Replace processes
    if (processes !== undefined) {
      await query({
        query: `DELETE FROM standard_processes WHERE standard_id = ?`,
        values: [id]
      });

      const parsed = parseStandardProcessesPayload(processes);
      if (!parsed.ok) {
        return NextResponse.json({ message: parsed.message }, { status: 400 });
      }
      const sid = Number(id);
      for (let i = 0; i < parsed.items.length; i++) {
        const row = parsed.items[i];
        await insertStandardProcessRow(
          sid,
          row.stepName,
          i,
          null,
          null
        );
      }
    }

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
      values: [id]
    });

    return NextResponse.json({ message: 'Standard deleted' });
  } catch (error) {
    console.error('Error deleting standard:', error);
    return NextResponse.json({ message: 'Error deleting standard' }, { status: 500 });
  }
}
