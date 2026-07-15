import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds } from '@/lib/department-head';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';
import {
  getAvailableFinancialYears,
  getCurrentFinancialYear,
  normalizeFinancialYear,
} from '@/lib/questionnaire/fy-utils';

export const dynamic = 'force-dynamic';

async function authHod() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  const departmentIds = await getVisibleDepartmentIds(decoded.userId);
  if (!departmentIds.length) {
    return { error: NextResponse.json({ message: 'No department assigned' }, { status: 403 }) };
  }
  return { userId: decoded.userId, departmentIds };
}

function currentPeriod() {
  return getCurrentFinancialYear();
}

function fiscalPeriods(): string[] {
  const years = getAvailableFinancialYears();
  const currentStart = Number(currentPeriod().slice(0, 4));
  const next = `${currentStart + 1}/${currentStart + 2}`;
  return years.includes(next) ? years : [...years, next];
}

function resolvePeriod(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return currentPeriod();
  const short = s.match(/^FY\s*(\d{2})\s*\/\s*(\d{2})$/i);
  if (short) {
    const start = 2000 + Number(short[1]);
    return `${start}/${start + 1}`;
  }
  return normalizeFinancialYear(s.replace(/^FY\s*/i, ''));
}

function isFiscalPeriod(period: string): boolean {
  return fiscalPeriods().includes(period);
}

/** List indicator report catalog + existing self-reports for HOD. */
export async function GET(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();

    const url = new URL(request.url);
    const period = resolvePeriod(url.searchParams.get('period'));
    const placeholders = auth.departmentIds.map(() => '?').join(',');
    // Legacy report rows can contain a manually-entered period. They remain
    // readable/selectable, but new values are limited to the FY dropdown.
    const storedPeriods = (await query({
      query: `
        SELECT DISTINCT reporting_period
        FROM sds_indicator_reports
        WHERE department_id IN (${placeholders})
      `,
      values: auth.departmentIds,
    })) as { reporting_period: string }[];
    const legacyPeriods = storedPeriods
      .map((row) => String(row.reporting_period || '').trim())
      .filter((value) => value && !isFiscalPeriod(resolvePeriod(value)));
    const requestedLegacy = legacyPeriods.includes(period);
    if (!isFiscalPeriod(period) && !requestedLegacy) {
      return NextResponse.json({ message: 'Choose a valid financial year.' }, { status: 400 });
    }
    const storedValuesForPeriod = storedPeriods
      .map((row) => String(row.reporting_period || '').trim())
      .filter((value) => requestedLegacy ? value === period : resolvePeriod(value) === period);

    const catalog = (await query({
      query: `
        SELECT s.id AS standard_id, s.code AS standard_code, s.title AS standard_title,
               o.id AS output_id, o.output_code, o.sequence_no, o.service_description,
               o.performance_indicators_json
        FROM sds_standards s
        JOIN sds_outputs o ON o.standard_id = s.id
        WHERE s.is_active = 1
          AND s.owner_department_id IN (${placeholders})
        ORDER BY s.code ASC, o.sequence_no ASC, o.id ASC
      `,
      values: auth.departmentIds,
    })) as Record<string, unknown>[];

    const reports = storedValuesForPeriod.length
      ? (await query({
        query: `
          SELECT r.*
          FROM sds_indicator_reports r
          WHERE r.department_id IN (${placeholders})
            AND r.reporting_period IN (${storedValuesForPeriod.map(() => '?').join(',')})
          ORDER BY r.updated_at DESC, r.id DESC
        `,
        values: [...auth.departmentIds, ...storedValuesForPeriod],
      })) as Record<string, unknown>[]
      : [];

    const items = catalog.map((row) => {
      let indicators: string[] = [];
      try {
        const raw = row.performance_indicators_json;
        if (Array.isArray(raw)) indicators = raw.map(String);
        else if (typeof raw === 'string') {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) indicators = parsed.map(String);
        }
      } catch {
        indicators = [];
      }
      return {
        standard_id: Number(row.standard_id),
        standard_code: String(row.standard_code || ''),
        standard_title: String(row.standard_title || ''),
        output_id: Number(row.output_id),
        output_code: String(row.output_code || ''),
        sequence_no: Number(row.sequence_no || 0),
        service_description: String(row.service_description || ''),
        performance_indicators: indicators,
      };
    });

    return NextResponse.json({
      period,
      available_periods: [...fiscalPeriods(), ...legacyPeriods.filter((value) => !fiscalPeriods().includes(value))],
      catalog: items,
      reports: reports.map((r) => ({
        ...r,
        id: Number(r.id),
        standard_id: Number(r.standard_id),
        output_id: r.output_id != null ? Number(r.output_id) : null,
        department_id: Number(r.department_id),
        reported_by: Number(r.reported_by),
      })),
    });
  } catch (e) {
    console.error('sds indicator-reports GET', e);
    return NextResponse.json({ message: 'Error loading indicator reports' }, { status: 500 });
  }
}

/**
 * HOD self-reported PI values — no approval workflow (heads of unit own the figure).
 * Upserts by (output_id|standard_id + department + period + indicator_text).
 */
export async function POST(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();

    const body = await request.json();
    const standardId = Number(body.standard_id);
    const outputId = body.output_id != null ? Number(body.output_id) : null;
    const indicatorText = String(body.indicator_text || '').trim();
    const valueText = String(body.value_text || '').trim() || null;
    const comment = String(body.comment || '').trim() || null;
    const period = resolvePeriod(body.reporting_period);
    const departmentId = Number(body.department_id || auth.departmentIds[0]);

    if (!standardId || !indicatorText || !period) {
      return NextResponse.json(
        { message: 'standard_id, indicator_text and reporting_period required' },
        { status: 400 },
      );
    }
    if (!auth.departmentIds.includes(departmentId)) {
      return NextResponse.json({ message: 'Not authorized for department' }, { status: 403 });
    }
    if (!isFiscalPeriod(period)) {
      const legacy = (await query({
        query: `
          SELECT 1 FROM sds_indicator_reports
          WHERE department_id = ? AND reporting_period = ?
          LIMIT 1
        `,
        values: [departmentId, period],
      })) as { 1: number }[];
      if (!legacy.length) {
        return NextResponse.json({ message: 'Choose a valid financial year.' }, { status: 400 });
      }
    }

    const owned = (await query({
      query: `
        SELECT id, owner_department_id FROM sds_standards
        WHERE id = ? AND is_active = 1
      `,
      values: [standardId],
    })) as { id: number; owner_department_id: number | null }[];
    if (!owned.length) return NextResponse.json({ message: 'Standard not found' }, { status: 404 });
    if (!owned[0].owner_department_id || !auth.departmentIds.includes(Number(owned[0].owner_department_id))) {
      return NextResponse.json({ message: 'Not authorized for this standard' }, { status: 403 });
    }

    if (outputId) {
      const outs = (await query({
        query: 'SELECT id FROM sds_outputs WHERE id = ? AND standard_id = ?',
        values: [outputId, standardId],
      })) as { id: number }[];
      if (!outs.length) return NextResponse.json({ message: 'Output not found on standard' }, { status: 400 });
    }

    const existing = (await query({
      query: `
        SELECT id FROM sds_indicator_reports
        WHERE standard_id = ?
          AND department_id = ?
          AND reporting_period = ?
          AND indicator_text = ?
          AND ${(outputId ? 'output_id = ?' : 'output_id IS NULL')}
        LIMIT 1
      `,
      values: outputId
        ? [standardId, departmentId, period, indicatorText, outputId]
        : [standardId, departmentId, period, indicatorText],
    })) as { id: number }[];

    if (existing.length) {
      await query({
        query: `
          UPDATE sds_indicator_reports
          SET value_text = ?, comment = ?, reported_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        values: [valueText, comment, auth.userId, existing[0].id],
      });
      return NextResponse.json({ message: 'Updated', id: existing[0].id, approval: 'none' });
    }

    const result = (await query({
      query: `
        INSERT INTO sds_indicator_reports
          (standard_id, output_id, department_id, reported_by, reporting_period, indicator_text, value_text, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values: [standardId, outputId, departmentId, auth.userId, period, indicatorText, valueText, comment],
    })) as { insertId?: number };

    return NextResponse.json({
      message: 'Saved',
      id: Number(result.insertId || 0),
      approval: 'none',
    });
  } catch (e) {
    console.error('sds indicator-reports POST', e);
    return NextResponse.json({ message: 'Error saving indicator report' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authHod();
    if ('error' in auth) return auth.error;
    await ensureSdsSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const rows = (await query({
      query: 'SELECT id, department_id FROM sds_indicator_reports WHERE id = ?',
      values: [id],
    })) as { id: number; department_id: number }[];
    if (!rows.length) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (!auth.departmentIds.includes(Number(rows[0].department_id))) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    await query({ query: 'DELETE FROM sds_indicator_reports WHERE id = ?', values: [id] });
    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    console.error('sds indicator-reports DELETE', e);
    return NextResponse.json({ message: 'Error deleting report' }, { status: 500 });
  }
}
