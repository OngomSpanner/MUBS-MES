export type ParsedStandardProcess = {
  stepName: string;
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
    items.push({ stepName });
  }
  if (items.length === 0) {
    return { ok: false, message: 'At least one process is required.' };
  }
  return { ok: true, items };
}
