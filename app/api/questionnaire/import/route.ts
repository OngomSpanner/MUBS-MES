import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const VALID_UOMS = new Set(['numeric', 'ratio', 'percentage', 'currency', 'text', 'list']);

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { role?: string } | null;
  if (!decoded || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes'].includes(v.toLowerCase());
  return Boolean(v);
}

function splitSemi(s: unknown): string[] {
  return String(s ?? '').split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
}

interface ParsedRow {
  rowNum: number;
  outcome_type: string;
  outcome_label: string;
  indicator_text: string;
  dept_names: string[];
  fin_years: string[];
  metrics: { metric_text: string; unit_of_measure: string }[];
  errors: string[];
}

function parseRows(records: Record<string, unknown>[]): ParsedRow[] {
  return records.map((row, i) => {
    const rowNum = i + 2; // 1-indexed, header is row 1
    const errors: string[] = [];

    const outcome_type = String(row['outcome_type'] ?? row['Outcome Type'] ?? row['type'] ?? '').trim();
    const outcome_label = String(row['outcome_label'] ?? row['Outcome Label'] ?? row['outcome'] ?? '').trim();
    const indicator_text = String(row['indicator_text'] ?? row['Indicator'] ?? row['Performance Indicator'] ?? '').trim();
    const dept_names = splitSemi(row['dept_names'] ?? row['Departments'] ?? row['department_names'] ?? '');
    const fin_years = splitSemi(row['fin_years'] ?? row['Financial Years'] ?? row['financial_years'] ?? '');

    if (!['Outcome', 'Output'].includes(outcome_type)) errors.push(`outcome_type must be 'Outcome' or 'Output'`);
    if (!outcome_label) errors.push('outcome_label is required');
    if (!indicator_text) errors.push('indicator_text is required');
    if (dept_names.length === 0) errors.push('dept_names: at least one department required');
    if (fin_years.length === 0) errors.push('fin_years: at least one financial year required');

    // Collect metrics (metric_1_text, metric_1_uom, metric_2_text, metric_2_uom, …)
    const metrics: { metric_text: string; unit_of_measure: string }[] = [];
    for (let n = 1; n <= 30; n++) {
      const mText = String(row[`metric_${n}_text`] ?? row[`Metric ${n}`] ?? '').trim();
      if (!mText) break;
      const mUom = String(row[`metric_${n}_uom`] ?? row[`Metric ${n} UoM`] ?? 'numeric').trim().toLowerCase();
      if (!VALID_UOMS.has(mUom)) errors.push(`metric_${n}_uom: invalid value '${mUom}'`);
      metrics.push({ metric_text: mText, unit_of_measure: VALID_UOMS.has(mUom) ? mUom : 'numeric' });
    }
    if (metrics.length === 0) errors.push('At least one metric_1_text is required');

    return { rowNum, outcome_type, outcome_label, indicator_text, dept_names, fin_years, metrics, errors };
  });
}

/** POST /api/questionnaire/import — parse only, return preview */
export async function POST(request: Request) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return NextResponse.json({ message: 'Only .xlsx, .xls, or .csv files are accepted' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (records.length === 0) {
      return NextResponse.json({ message: 'File is empty or has no data rows' }, { status: 400 });
    }

    const parsed = parseRows(records);

    // Look up departments by name for preview
    const allDepts = await query({ query: 'SELECT id, name, external_name FROM departments WHERE is_active=1', values: [] }) as any[];
    const deptByName = new Map<string, number>();
    for (const d of allDepts) {
      const canonical = (d.external_name?.trim() || d.name?.trim() || '').toLowerCase();
      deptByName.set(canonical, d.id);
      deptByName.set((d.name?.trim() || '').toLowerCase(), d.id);
    }

    // Check existing indicators for duplicates
    const existingIndicators = await query({ query: 'SELECT indicator_text, outcome_id FROM q_indicators', values: [] }) as any[];
    const existingOutcomes = await query({ query: 'SELECT id, label FROM q_outcomes', values: [] }) as any[];
    const outcomeByLabel = new Map<string, number>();
    for (const o of existingOutcomes) outcomeByLabel.set((o.label || '').trim().toLowerCase(), o.id);
    const existingSet = new Set(existingIndicators.map((i: any) => `${i.outcome_id}:${String(i.indicator_text).toLowerCase().trim()}`));

    const preview = parsed.map((row) => {
      const deptResolved = row.dept_names.map((name) => ({
        name,
        department_id: deptByName.get(name.toLowerCase()) ?? null,
      }));
      const unknownDepts = deptResolved.filter((d) => d.department_id === null).map((d) => d.name);
      const rowErrors = [...row.errors];
      if (unknownDepts.length > 0) rowErrors.push(`Unknown departments: ${unknownDepts.join(', ')}`);

      const outcomeId = outcomeByLabel.get(`${row.outcome_type} — ${row.outcome_label}`.toLowerCase()) ??
                        outcomeByLabel.get(row.outcome_label.toLowerCase());
      const duplicateKey = outcomeId ? `${outcomeId}:${row.indicator_text.toLowerCase()}` : null;
      const isDuplicate = duplicateKey ? existingSet.has(duplicateKey) : false;

      return {
        ...row,
        errors: rowErrors,
        dept_resolved: deptResolved,
        is_duplicate: isDuplicate,
        has_errors: rowErrors.length > 0,
      };
    });

    return NextResponse.json({ rows: preview, total: preview.length });
  } catch (e) {
    console.error('import POST', e);
    return NextResponse.json({ message: 'Error parsing file' }, { status: 500 });
  }
}
