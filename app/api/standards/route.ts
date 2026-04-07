import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { buildPublicStandardsList } from '@/lib/standards-api';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { insertStandardProcessRow, selectStandardProcessesAll } from '@/lib/standard-processes-db';
import { parseStandardProcessesPayload } from '@/lib/standard-processes-payload';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    let standards: Record<string, unknown>[];
    try {
      standards = (await query({
        query: `SELECT id, title, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, target, created_at FROM standards ORDER BY created_at DESC`,
      })) as Record<string, unknown>[];
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        try {
          standards = (await query({
            query: `SELECT id, title, quality_standard, output_standard, performance_indicator, target, created_at FROM standards ORDER BY created_at DESC`,
          })) as Record<string, unknown>[];
          standards = standards.map((s) => ({ ...s, duration_value: null, duration_unit: null }));
        } catch (e2: unknown) {
          const err2 = e2 as { code?: string; errno?: number };
          if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
            standards = (await query({
              query: `SELECT id, title, quality_standard, output_standard, duration_value, duration_unit, target, created_at FROM standards ORDER BY created_at DESC`,
            })) as Record<string, unknown>[];
            standards = standards.map((s) => ({ ...s, performance_indicator: null }));
          } else {
            // Oldest schema: neither column exists
            standards = (await query({
              query: `SELECT id, title, quality_standard, output_standard, target, created_at FROM standards ORDER BY created_at DESC`,
            })) as Record<string, unknown>[];
            standards = standards.map((s) => ({ ...s, performance_indicator: null, duration_value: null, duration_unit: null }));
          }
        }
      } else {
        throw e;
      }
    }
    
    const processes = await selectStandardProcessesAll();

    return NextResponse.json(buildPublicStandardsList(standards, processes));
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
    const { title: rawTitle, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, processes } = body;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title) return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    const quality = typeof quality_standard === 'string' ? quality_standard.trim() : '';
    const output = typeof output_standard === 'string' ? output_standard.trim() : '';
    const pi = typeof performance_indicator === 'string' ? performance_indicator.trim() : '';
    const unit = typeof duration_unit === 'string' ? duration_unit.trim().toLowerCase() : '';
    const dvNum = duration_value != null && duration_value !== '' ? parseInt(String(duration_value), 10) : null;
    if (!quality) return NextResponse.json({ message: 'Quality standard is required' }, { status: 400 });
    if (!output) return NextResponse.json({ message: 'Output standard is required' }, { status: 400 });
    // Duration is required when duration columns exist; otherwise, API will ignore it.
    const insertValues = [
      title, 
      quality, 
      output, 
      pi || null, 
      dvNum, 
      unit, 
      null,
    ];

    let result: unknown;
    try {
      if (!unit) return NextResponse.json({ message: 'Duration unit is required' }, { status: 400 });
      if (dvNum == null || !Number.isFinite(dvNum) || dvNum < 1) {
        return NextResponse.json({ message: 'Duration value must be at least 1' }, { status: 400 });
      }
      result = await query({
        query: `INSERT INTO standards (
        title, quality_standard, output_standard, performance_indicator, duration_value, duration_unit, target
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: insertValues,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number };
      if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.errno === 1054) {
        // Try schema with performance_indicator only
        try {
          result = await query({
            query: `INSERT INTO standards (title, quality_standard, output_standard, performance_indicator, target) VALUES (?, ?, ?, ?, ?)`,
            values: [title, quality, output, pi || null, null],
          });
        } catch (e2: unknown) {
          const err2 = e2 as { code?: string; errno?: number };
          if (err2?.code === 'ER_BAD_FIELD_ERROR' || err2?.errno === 1054) {
            // Oldest schema
            result = await query({
              query: `INSERT INTO standards (title, quality_standard, output_standard, target) VALUES (?, ?, ?, ?)`,
              values: [title, quality, output, null],
            });
          } else {
            throw e2;
          }
        }
      } else {
        throw e;
      }
    }

    const standardId = Number((result as { insertId?: number | bigint }).insertId);
    if (!Number.isFinite(standardId) || standardId <= 0) {
      console.error('standards POST: missing insertId', result);
      return NextResponse.json({ message: 'Error creating standard' }, { status: 500 });
    }

    const parsed = parseStandardProcessesPayload(processes);
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }
    for (let i = 0; i < parsed.items.length; i++) {
      const row = parsed.items[i];
      await insertStandardProcessRow(
        standardId,
        row.stepName,
        i,
        null,
        null
      );
    }

    return NextResponse.json({ message: 'Standard created', id: standardId }, { status: 201 });
  } catch (error) {
    console.error('Error creating standard:', error);
    return NextResponse.json({ message: 'Error creating standard' }, { status: 500 });
  }
}
