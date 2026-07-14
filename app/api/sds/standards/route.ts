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

export async function GET(request: Request) {
  try {
    if (!(await requireAuth())) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await ensureSdsSchema();

    const url = new URL(request.url);
    const departmentId = Number(url.searchParams.get('departmentId') || 0);
    const pillar = String(url.searchParams.get('pillar') || '').trim();
    const q = String(url.searchParams.get('q') || '').trim();

    const where: string[] = ['s.is_active = 1'];
    const values: unknown[] = [];
    if (departmentId > 0) {
      where.push('s.owner_department_id = ?');
      values.push(departmentId);
    }
    if (pillar) {
      where.push('s.pillar = ?');
      values.push(pillar);
    }
    if (q) {
      where.push('(s.code LIKE ? OR s.title LIKE ? OR s.owner_label LIKE ?)');
      values.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const rows = (await query({
      query: `
        SELECT s.*,
          COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS owner_department_name,
          (SELECT COUNT(*) FROM sds_outputs o WHERE o.standard_id = s.id) AS output_count,
          (SELECT COUNT(*) FROM sds_activities a
            JOIN sds_outputs o2 ON o2.id = a.output_id
            WHERE o2.standard_id = s.id) AS activity_count
        FROM sds_standards s
        LEFT JOIN departments d ON d.id = s.owner_department_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.pillar ASC, s.code ASC
      `,
      values,
    })) as Record<string, unknown>[];

    return NextResponse.json({
      standards: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        owner_department_id: r.owner_department_id != null ? Number(r.owner_department_id) : null,
        output_count: Number(r.output_count || 0),
        activity_count: Number(r.activity_count || 0),
        objectives: (() => {
          try {
            const raw = r.objectives_json;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') return JSON.parse(raw);
            return [];
          } catch {
            return [];
          }
        })(),
      })),
    });
  } catch (e) {
    console.error('sds standards GET', e);
    return NextResponse.json({ message: 'Error loading SDS standards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await ensureSdsSchema();
    const body = await request.json();

    const code = parseSdsStandardCode(String(body.code || '')).normalized;
    const title = String(body.title || '').trim();
    if (!code || !title) {
      return NextResponse.json({ message: 'code and title are required' }, { status: 400 });
    }

    const parsed = parseSdsStandardCode(code);
    const ownerDepartmentId = Number(body.owner_department_id);
    const objectives = Array.isArray(body.objectives)
      ? body.objectives.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    const result = (await query({
      query: `
        INSERT INTO sds_standards (
          code, title, owner_department_id, owner_label, supporting_units, pathway, user_fee,
          purpose, objectives_json, pillar, pillar_code, objective_code, owner_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values: [
        code,
        title,
        Number.isFinite(ownerDepartmentId) && ownerDepartmentId > 0 ? ownerDepartmentId : null,
        String(body.owner_label || '').trim() || parsed.ownerAbbrev,
        String(body.supporting_units || '').trim() || null,
        String(body.pathway || '').trim() || null,
        String(body.user_fee || '').trim() || null,
        String(body.purpose || '').trim() || null,
        JSON.stringify(objectives),
        String(body.pillar || '').trim() || parsed.pillar,
        parsed.pillarAbbrev,
        parsed.objectiveNum ? `OBJ${parsed.objectiveNum}` : null,
        parsed.ownerAbbrev,
      ],
    })) as { insertId?: number };

    return NextResponse.json({ id: Number(result.insertId) }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Standard code already exists' }, { status: 409 });
    }
    console.error('sds standards POST', e);
    return NextResponse.json({ message: 'Error creating SDS standard' }, { status: 500 });
  }
}
