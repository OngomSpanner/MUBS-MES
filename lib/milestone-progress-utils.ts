/** Client-safe milestone helpers (no database imports). */

export type MilestoneProcessRow = {
  step_name: string;
  milestone_progress: string;
};

/** Evenly distribute cumulative milestone % across ordered steps (10, 20, … 100). */
export function defaultMilestoneProgressForStep(stepIndex: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  const step = stepIndex + 1;
  return Math.min(100, Math.round((step / totalSteps) * 100));
}

/** Cumulative % values for N named steps. */
export function milestonePercentsForStepCount(namedStepCount: number): number[] {
  if (namedStepCount <= 0) return [];
  return Array.from({ length: namedStepCount }, (_, i) => defaultMilestoneProgressForStep(i, namedStepCount));
}

/** Fill empty milestone_progress fields; preserve user-entered values. */
export function applyDefaultMilestonesToProcessRows<T extends MilestoneProcessRow>(processes: T[]): T[] {
  const namedIndices = processes
    .map((p, i) => (String(p.step_name || '').trim() ? i : -1))
    .filter((i) => i >= 0);
  const total = namedIndices.length;
  if (total === 0) return processes;

  const percents = milestonePercentsForStepCount(total);
  let namedIdx = 0;
  return processes.map((p) => {
    if (!String(p.step_name || '').trim()) return p;
    const current = String(p.milestone_progress || '').trim();
    if (current !== '' && Number.isFinite(Number(current))) return p;
    const pct = percents[namedIdx] ?? 100;
    namedIdx += 1;
    return { ...p, milestone_progress: String(pct) };
  });
}

/** Recompute all milestone % for named steps (e.g. after add/remove). */
export function redistributeMilestonePercents<T extends MilestoneProcessRow>(processes: T[]): T[] {
  const namedIndices = processes
    .map((p, i) => (String(p.step_name || '').trim() ? i : -1))
    .filter((i) => i >= 0);
  const total = namedIndices.length;
  if (total === 0) return processes;

  const percents = milestonePercentsForStepCount(total);
  let namedIdx = 0;
  return processes.map((p) => {
    if (!String(p.step_name || '').trim()) return p;
    const pct = percents[namedIdx] ?? 100;
    namedIdx += 1;
    return { ...p, milestone_progress: String(pct) };
  });
}
