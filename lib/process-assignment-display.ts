export type ProcessAssignmentDisplayRow = {
  id: number;
  staff_id: number | null;
  staff_name: string | null;
  section_id?: number | null;
  section_name?: string | null;
  status: string;
  subtasks?: Array<{ assigned_to: number; status?: string | null }>;
};

/** Preserves API order; merges direct rows that share the same section into one item. */
export function expandProcessAssignmentsForDisplay<T extends ProcessAssignmentDisplayRow>(assignments: T[]) {
  const seenSection = new Set<number>();
  const out: Array<
    | { kind: 'container'; a: T }
    | { kind: 'section_group'; rows: T[] }
    | { kind: 'direct'; a: T }
  > = [];

  for (const a of assignments) {
    const hasStaff = String(a.staff_name ?? '').trim() !== '';
    if (!hasStaff) {
      out.push({ kind: 'container', a });
      continue;
    }
    const sid = a.section_id != null ? Number(a.section_id) : null;
    const sn = String(a.section_name ?? '').trim();
    if (sid != null && Number.isFinite(sid) && sn !== '') {
      if (seenSection.has(sid)) continue;
      seenSection.add(sid);
      const rows = assignments.filter(
        (x) =>
          String(x.staff_name ?? '').trim() !== '' &&
          x.section_id != null &&
          Number(x.section_id) === sid
      );
      out.push({ kind: 'section_group', rows });
      continue;
    }
    out.push({ kind: 'direct', a });
  }
  return out;
}
