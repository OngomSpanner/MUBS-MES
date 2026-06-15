/**
 * Public shape for standards returned by /api/standards.
 * Legacy DB columns (unit_of_measure, target_fy*) are not exposed to clients.
 * `target` on standards is legacy; new work uses per-FY targets on strategic_activities.
 */

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
  title: string;
  quality_standard: string | null;
  output_standard: string | null;
  /** What evidences completion of this standard process (e.g. signed form, published report). */
  performance_indicator: string | null;
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
    return {
      id,
      title: String(s.title ?? ''),
      quality_standard: (s.quality_standard as string | null) ?? null,
      output_standard: (s.output_standard as string | null) ?? null,
      performance_indicator:
        s.performance_indicator != null && String(s.performance_indicator).trim() !== ''
          ? String(s.performance_indicator)
          : null,
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
      processes: byStandard.get(id) ?? [],
    };
  });
}

export function buildPublicStandardDetail(
  row: Record<string, unknown>,
  processes: Record<string, unknown>[],
  departmentIds: number[] = [],
  departmentNames: string[] = []
): PublicStandard {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    quality_standard: (row.quality_standard as string | null) ?? null,
    output_standard: (row.output_standard as string | null) ?? null,
    performance_indicator:
      row.performance_indicator != null && String(row.performance_indicator).trim() !== ''
        ? String(row.performance_indicator)
        : null,
    duration_value:
      row.duration_value != null && row.duration_value !== '' && Number.isFinite(Number(row.duration_value))
        ? Number(row.duration_value)
        : null,
    duration_unit:
      row.duration_unit != null && String(row.duration_unit).trim() !== ''
        ? String(row.duration_unit).trim().toLowerCase()
        : null,
    target: (row.target as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    department_ids: departmentIds,
    department_names: departmentNames,
    processes: processes.map(toPublicProcessRow),
  };
}
