export type MetricTreeNode = {
  id: number;
  metric_text: string;
  unit_of_measure: string;
  parent_metric_id?: number | null;
  aggregation?: string | null;
  is_total?: boolean | number;
  sort_order: number;
};

export type MetricDisplayRow =
  | {
      kind: 'standalone';
      metric: MetricTreeNode;
      index: number;
    }
  | {
      kind: 'group';
      parent: MetricTreeNode;
      index: number;
      children: MetricTreeNode[];
      totalMetric: MetricTreeNode | null;
    };

export function childrenByParentId<T extends MetricTreeNode>(metrics: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const m of metrics) {
    const p = m.parent_metric_id != null ? Number(m.parent_metric_id) : null;
    if (!p) continue;
    const list = map.get(p) ?? [];
    list.push(m);
    map.set(p, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return map;
}

export function isTotalMetric(m: MetricTreeNode): boolean {
  return m.is_total === true || m.is_total === 1;
}

export function isParentMetric(m: MetricTreeNode, byParent: Map<number, MetricTreeNode[]>): boolean {
  return (m.parent_metric_id == null || Number(m.parent_metric_id) === 0) && (byParent.get(m.id)?.length ?? 0) > 0;
}

/** Metrics ambassadors/HODs actually enter values for (excludes parent headers and total rows). */
export function inputMetricsForIndicator<T extends MetricTreeNode>(metrics: T[]): T[] {
  const byParent = childrenByParentId(metrics);
  const hasChildren = new Set<number>(Array.from(byParent.keys()));
  const inputs: T[] = [];

  for (const m of metrics) {
    if (isTotalMetric(m)) continue;
    const parentId = m.parent_metric_id != null ? Number(m.parent_metric_id) : null;
    if (parentId) {
      inputs.push(m);
      continue;
    }
    if (!hasChildren.has(m.id)) {
      inputs.push(m);
    }
  }

  return inputs.sort((a, b) => a.sort_order - b.sort_order);
}

export function buildMetricDisplayRows<T extends MetricTreeNode>(metrics: T[]): MetricDisplayRow[] {
  const byParent = childrenByParentId(metrics);
  const parents = metrics
    .filter((m) => m.parent_metric_id == null || Number(m.parent_metric_id) === 0)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rows: MetricDisplayRow[] = [];
  let topIndex = 0;

  for (const p of parents) {
    const children = byParent.get(p.id) ?? [];
    const totalMetric = children.find((c) => isTotalMetric(c)) ?? null;
    const inputChildren = children.filter((c) => !isTotalMetric(c));

    if (inputChildren.length > 0) {
      topIndex += 1;
      rows.push({
        kind: 'group',
        parent: p,
        index: topIndex,
        children: inputChildren,
        totalMetric,
      });
    } else {
      topIndex += 1;
      rows.push({ kind: 'standalone', metric: p, index: topIndex });
    }
  }

  return rows;
}

export function sumSubMetricValues(
  children: MetricTreeNode[],
  fy: string,
  getValue: (metricId: number, fy: string) => string | null | undefined,
): string {
  const inputs = children.filter((c) => !isTotalMetric(c));
  const total = inputs.reduce((acc, c) => {
    const raw = String(getValue(c.id, fy) ?? '').trim();
    if (!raw) return acc;
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
  return total ? String(total) : '';
}

export function canAutoSumTotal(parent: MetricTreeNode): boolean {
  return parent.unit_of_measure === 'numeric' || parent.unit_of_measure === 'currency';
}

export type MetricSaveInput = {
  id?: number;
  client_id?: string;
  parent_metric_id?: number | null;
  parent_client_id?: string | null;
  metric_text: string;
  unit_of_measure: string;
  aggregation?: string | null;
  is_total?: boolean | number;
};

export function parseBulkSubMetricLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function subMetricLetter(index: number): string {
  // 0 -> a, 25 -> z, 26 -> aa, 27 -> ab, ...
  let n = Math.max(0, Math.floor(index));
  let out = '';
  while (true) {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return out;
}

export const MUBS_CAMPUS_PRESETS = [
  'Main Campus (Nakawa)',
  'Arua Campus',
  'Mbarara Campus',
  'Mbale Campus',
  'Jinja Campus',
] as const;
