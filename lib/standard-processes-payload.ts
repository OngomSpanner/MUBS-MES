export type ParsedStandardProcess = {
  stepName: string;
  durationValue: number | null;
  durationUnit: string | null;
};

export function parseStandardProcessesPayload(
  processes: unknown
): { ok: true; items: ParsedStandardProcess[] } | { ok: false; message: string } {
  if (!Array.isArray(processes)) {
    return { ok: false, message: 'At least one process is required.' };
  }
  const items: ParsedStandardProcess[] = [];
  for (const p of processes) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const stepName = typeof o.step_name === 'string' ? o.step_name.trim() : '';
    if (!stepName) continue;
    const rawUnit = typeof o.duration_unit === 'string' ? o.duration_unit.trim().toLowerCase() : '';
    const rawVal =
      o.duration_value != null && o.duration_value !== '' ? parseInt(String(o.duration_value), 10) : null;
    const durationUnit = rawUnit || null;
    const durationValue = rawVal != null && Number.isFinite(rawVal) && rawVal > 0 ? rawVal : null;

    if ((durationUnit && durationValue == null) || (!durationUnit && durationValue != null)) {
      return {
        ok: false,
        message: `Each process task duration needs both value and unit (task: "${stepName}").`,
      };
    }

    items.push({ stepName, durationValue, durationUnit });
  }
  if (items.length === 0) {
    return { ok: false, message: 'At least one process is required.' };
  }
  return { ok: true, items };
}
