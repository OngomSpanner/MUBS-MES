import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSdsSchema } from '@/lib/sds/schema';

export const dynamic = 'force-dynamic';

/**
 * HRM appraisal pull endpoint (pull model).
 * Auth: Authorization: Bearer <SDS_HRM_PULL_SECRET or CRON_SECRET>
 * Lookup by email only.
 * This endpoint is deliberately read-only: HRMS owns appraisal ratings and comments.
 */
function authorize(request: Request): boolean {
  const secret = process.env.SDS_HRM_PULL_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const altKey = request.headers.get('x-api-key') || '';
  return token === secret || altKey === secret;
}

function toText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = toText(value);
  const match = text?.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  // Keep this intentionally simple (server-to-server integration, not user input forms).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseIndicatorList(raw: unknown): string[] {
  try {
    const values = Array.isArray(raw)
      ? raw
      : typeof raw === 'string' && raw.trim()
        ? JSON.parse(raw)
        : [];
    return Array.isArray(values)
      ? values.map((value) => String(value).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function formatTargets(targets: {
  targetDate: string | null;
  durationText: string | null;
  qualityStandard: string | null;
  frequency: string | null;
  coverage: string | null;
}): string | null {
  const parts = [
    targets.targetDate ? `Due: ${targets.targetDate}` : null,
    targets.durationText ? `Duration: ${targets.durationText}` : null,
    targets.qualityStandard ? `Quality: ${targets.qualityStandard}` : null,
    targets.frequency ? `Frequency: ${targets.frequency}` : null,
    targets.coverage ? `Coverage: ${targets.coverage}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

/** CORS is intentionally not enabled: HRMS should call server-to-server, never expose the shared secret in a browser. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
    },
  });
}

export async function GET(request: Request) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    await ensureSdsSchema();

    const url = new URL(request.url);
    const emailRaw = String(url.searchParams.get('email') || '').trim();
    if (!emailRaw || !isValidEmail(emailRaw)) {
      return NextResponse.json({ message: 'Valid email is required (query param: ?email=...)' }, { status: 400 });
    }
    const email = normalizeEmail(emailRaw);

    const userMatchRows = (await query({
      query: 'SELECT id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      values: [email],
    })) as { id: number }[];
    const userId = Number(userMatchRows[0]?.id || 0);

    if (!userId) {
      return NextResponse.json({ message: 'User not found', entries: [] }, { status: 404 });
    }

    const userRows = (await query({
      query: `
        SELECT u.id, u.hrms_staff_id, u.employee_id, u.email, u.full_name,
               u.department_id,
               COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = ?
        LIMIT 1
      `,
      values: [userId],
    })) as Record<string, unknown>[];
    const user = userRows[0];
    if (!user) {
      return NextResponse.json({ message: 'User not found', entries: [] }, { status: 404 });
    }

    const rows = (await query({
      query: `
        SELECT a.id AS assignment_id, a.target_date, a.notes, a.assigned_at, a.status,
               a.department_id AS assignment_department_id,
               COALESCE(NULLIF(TRIM(assignment_department.external_name), ''), assignment_department.name) AS assignment_department_name,
               act.id AS activity_id, act.activity_name, act.duration_text, act.duration_days,
               act.sequence_no AS activity_sequence,
               o.id AS output_id, o.output_code, o.sequence_no AS output_sequence,
               o.service_description, o.performance_indicators_json,
               o.quality_standard, o.frequency, o.coverage,
               s.id AS standard_id, s.code AS standard_code, s.title AS standard_title,
               s.pillar, s.pillar_code
        FROM sds_activity_assignments a
        JOIN sds_activities act ON act.id = a.activity_id
        JOIN sds_outputs o ON o.id = act.output_id
        JOIN sds_standards s ON s.id = o.standard_id
        LEFT JOIN departments assignment_department ON assignment_department.id = a.department_id
        WHERE a.staff_user_id = ? AND a.status = 'active'
        ORDER BY a.target_date IS NULL, a.target_date ASC, a.id ASC
      `,
      values: [userId],
    })) as Record<string, unknown>[];

    const staff = {
      user_id: Number(user.id),
      hrms_staff_id: user.hrms_staff_id != null ? Number(user.hrms_staff_id) : null,
      staff_number: toText(user.employee_id),
      email: toText(user.email),
      name: toText(user.full_name),
      department_id: user.department_id != null ? Number(user.department_id) : null,
      department: toText(user.department_name),
    };

    const entries = rows.map((r) => {
      const performanceIndicators = parseIndicatorList(r.performance_indicators_json);
      const activityName = toText(r.activity_name) || '';
      const outputDescription = toText(r.service_description);
      const targets = {
        target_date: toIsoDate(r.target_date),
        duration_text: toText(r.duration_text),
        duration_days: r.duration_days != null ? Number(r.duration_days) : null,
        quality_standard: toText(r.quality_standard),
        frequency: toText(r.frequency),
        coverage: toText(r.coverage),
      };
      const performanceTargets = formatTargets({
        targetDate: targets.target_date,
        durationText: targets.duration_text,
        qualityStandard: targets.quality_standard,
        frequency: targets.frequency,
        coverage: targets.coverage,
      });

      return {
        // Stable Section B fields
        staff,
        standard: {
          id: Number(r.standard_id),
          code: toText(r.standard_code),
          title: toText(r.standard_title),
          pillar: toText(r.pillar),
          pillar_code: toText(r.pillar_code),
        },
        output: {
          id: Number(r.output_id),
          output_code: toText(r.output_code),
          sequence: Number(r.output_sequence),
          service_description: outputDescription,
          title: outputDescription,
        },
        activity: {
          id: Number(r.activity_id),
          name: activityName,
          sequence: Number(r.activity_sequence),
          duration_text: targets.duration_text,
          duration_days: targets.duration_days,
        },
        assignment_id: Number(r.assignment_id),
        assigned_at: r.assigned_at,
        target_date: targets.target_date,
        notes: toText(r.notes),
        status: toText(r.status),
        department: {
          id: r.assignment_department_id != null ? Number(r.assignment_department_id) : staff.department_id,
          name: toText(r.assignment_department_name) || staff.department,
        },
        key_performance_output: activityName,
        performance_indicators: performanceIndicators,
        performance_targets: performanceTargets,
        target_details: targets,

        // Flat aliases retained for existing consumers of this endpoint.
        activity_id: Number(r.activity_id),
        activity_name: activityName,
        duration_text: targets.duration_text,
        activity_sequence: Number(r.activity_sequence),
        output_id: Number(r.output_id),
        output_code: toText(r.output_code),
        service_description: outputDescription,
        standard_code: toText(r.standard_code),
        standard_title: toText(r.standard_title),
        pillar: toText(r.pillar),
        pillar_code: toText(r.pillar_code),
        performance_output: outputDescription
          ? `${outputDescription} — ${activityName}`
          : activityName,
        performance_indicator: performanceIndicators[0] || null,
      };
    });

    return NextResponse.json({
      api_version: '1.1',
      status_filter: 'active',
      staff,
      // Top-level identity aliases retained for existing callers.
      user_id: staff.user_id,
      hrms_staff_id: staff.hrms_staff_id,
      staff_number: staff.staff_number,
      email: staff.email,
      entries,
    });
  } catch (e) {
    console.error('sds hrm appraisal GET', e);
    return NextResponse.json({ message: 'Error loading appraisal SDS entries' }, { status: 500 });
  }
}
