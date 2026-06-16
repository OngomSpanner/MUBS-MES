/**
 * Public shape for standards returned by /api/standards.
 * Legacy DB columns (unit_of_measure, target_fy*) are not exposed to clients.
 * `target` on standards is legacy; new work uses per-FY targets on strategic_activities.
 */

import {
  formatUserFeeDisplay,
  parsePerformanceIndicatorsFromRow,
  sdsFieldsFromRow,
} from '@/lib/standard-sds-fields';

export type PublicStandardProcess = {
  id: number;
  standard_id: number;
  step_name: string;
  step_order: number;
  duration_value: number | null;
  duration_unit: string | null;
  /** Cumulative activity progress % when this process step is complete. */
  milestone_progress: number | null;
};

export type PublicStandard = {
  id: number;
  standard_no: string | null;
  title: string;
  user_fee: string | null;
  user_fee_display: string;
  standard_owner: string | null;
  supporting_units: string | null;
  pathway: string | null;
  quality_standard: string | null;
  output_standard: string | null;
  /** What evidences completion of this standard process (e.g. signed form, published report). */
  performance_indicator: string | null;
  performance_indicators: string[];
  process_standard: string | null;
  time_standard: string | null;
  accessibility: string | null;
  coverage: string | null;
  frequency: string | null;
  target_beneficiary: string | null;
  access_criteria: string | null;
  methodology: string | null;
  inputs: string | null;
  /** Planned duration for the whole process (applies to all tasks). */
  duration_value: number | null;
  duration_unit: string | null;
  target: string | null;
  created_at: string | null;
  department_ids: number[];
  department_names: string[];
  processes: PublicStandardProcess[];
};

export function toPublicProcessRow(row: Record<string, unknown>): PublicStandardProcess {
  return {
    id: Number(row.id),
    standard_id: Number(row.standard_id),
    step_name: String(row.step_name ?? ''),
    step_order: Number(row.step_order ?? 0),
    duration_value:
      row.duration_value != null && row.duration_value !== '' && Number.isFinite(Number(row.duration_value))
        ? Number(row.duration_value)
        : null,
    duration_unit:
      row.duration_unit != null && String(row.duration_unit).trim() !== ''
        ? String(row.duration_unit).trim().toLowerCase()
        : null,
    milestone_progress:
      row.milestone_progress != null && row.milestone_progress !== '' && Number.isFinite(Number(row.milestone_progress))
        ? Number(row.milestone_progress)
        : null,
  };
}

function toPublicStandardCore(
  s: Record<string, unknown>,
  dept?: { department_ids: number[]; department_names: string[] },
  processes: PublicStandardProcess[] = []
): PublicStandard {
  const id = Number(s.id);
  const sds = sdsFieldsFromRow(s);
  const indicators = parsePerformanceIndicatorsFromRow(s);
  return {
    id,
    standard_no: sds.standard_no || null,
    title: String(s.title ?? ''),
    user_fee: sds.user_fee,
    user_fee_display: formatUserFeeDisplay(sds.user_fee),
    standard_owner: sds.standard_owner || null,
    supporting_units: sds.supporting_units,
    pathway: sds.pathway,
    quality_standard: (s.quality_standard as string | null) ?? null,
    output_standard: (s.output_standard as string | null) ?? null,
    performance_indicator:
      s.performance_indicator != null && String(s.performance_indicator).trim() !== ''
        ? String(s.performance_indicator)
        : indicators.length > 0
          ? indicators.join('\n')
          : null,
    performance_indicators: indicators,
    process_standard: sds.process_standard,
    time_standard: sds.time_standard,
    accessibility: sds.accessibility,
    coverage: sds.coverage,
    frequency: sds.frequency,
    target_beneficiary: sds.target_beneficiary,
    access_criteria: sds.access_criteria,
    methodology: sds.methodology,
    inputs: sds.inputs,
    duration_value:
      s.duration_value != null && s.duration_value !== '' && Number.isFinite(Number(s.duration_value))
        ? Number(s.duration_value)
        : null,
    duration_unit:
      s.duration_unit != null && String(s.duration_unit).trim() !== ''
        ? String(s.duration_unit).trim().toLowerCase()
        : null,
    target: (s.target as string | null) ?? null,
    created_at: (s.created_at as string | null) ?? null,
    department_ids: dept?.department_ids ?? [],
    department_names: dept?.department_names ?? [],
    processes,
  };
}

export function buildPublicStandardsList(
  standardRows: Record<string, unknown>[],
  allProcesses: Record<string, unknown>[],
  departmentMap?: Map<number, { department_ids: number[]; department_names: string[] }>
): PublicStandard[] {
  const byStandard = new Map<number, PublicStandardProcess[]>();
  for (const p of allProcesses) {
    const sid = Number(p.standard_id);
    if (!byStandard.has(sid)) byStandard.set(sid, []);
    byStandard.get(sid)!.push(toPublicProcessRow(p));
  }
  return standardRows.map((s) => {
    const id = Number(s.id);
    const dept = departmentMap?.get(id);
    return toPublicStandardCore(s, dept, byStandard.get(id) ?? []);
  });
}

export function buildPublicStandardDetail(
  row: Record<string, unknown>,
  processes: Record<string, unknown>[],
  departmentIds: number[] = [],
  departmentNames: string[] = []
): PublicStandard {
  return toPublicStandardCore(
    row,
    { department_ids: departmentIds, department_names: departmentNames },
    processes.map(toPublicProcessRow)
  );
}
