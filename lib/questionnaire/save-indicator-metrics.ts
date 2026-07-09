import { query } from '@/lib/db';
import type { MetricSaveInput } from '@/lib/questionnaire/metric-tree';

export async function saveIndicatorMetrics(
  indicatorId: number,
  validMetrics: MetricSaveInput[],
): Promise<void> {
  const existingMetrics = (await query({
    query: 'SELECT id FROM q_metrics WHERE indicator_id=?',
    values: [indicatorId],
  })) as { id: number }[];

  const existingIds = new Set(existingMetrics.map((m) => Number(m.id)));
  const incomingIds = new Set(validMetrics.filter((m) => m.id).map((m) => Number(m.id)));
  const clientIdToDbId = new Map<string, number>();

  for (const existing of existingMetrics) {
    const existingId = Number(existing.id);
    if (!incomingIds.has(existingId)) {
      const respCount = (await query({
        query: 'SELECT COUNT(*) as cnt FROM q_responses WHERE metric_id=?',
        values: [existing.id],
      })) as { cnt: number }[];
      if (Number(respCount[0]?.cnt ?? 0) === 0) {
        await query({ query: 'DELETE FROM q_metrics WHERE id=?', values: [existing.id] });
      }
    }
  }

  const pending = validMetrics.map((m, i) => ({ ...m, sort_order: i }));
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    for (let idx = pending.length - 1; idx >= 0; idx--) {
      const m = pending[idx];
      const uom = m.unit_of_measure || 'numeric';
      const metricText = String(m.metric_text || '').trim();
      if (!metricText) {
        pending.splice(idx, 1);
        continue;
      }

      const parentClient = m.parent_client_id ? String(m.parent_client_id) : '';
      const parentDbIdFromClient = parentClient ? clientIdToDbId.get(parentClient) : undefined;
      const parentDbId =
        parentDbIdFromClient != null
          ? parentDbIdFromClient
          : m.parent_metric_id != null
            ? Number(m.parent_metric_id)
            : null;

      if (parentClient && parentDbIdFromClient == null) continue;

      const aggregation =
        m.aggregation != null && String(m.aggregation).trim() ? String(m.aggregation).trim() : null;
      const isTotal = m.is_total === true || m.is_total === 1;

      if (m.id && existingIds.has(Number(m.id))) {
        await query({
          query: `
            UPDATE q_metrics
            SET metric_text=?, unit_of_measure=?, parent_metric_id=?, aggregation=?, is_total=?, sort_order=?
            WHERE id=?
          `,
          values: [metricText, uom, parentDbId, aggregation, isTotal ? 1 : 0, m.sort_order, Number(m.id)],
        });
        if (m.client_id) clientIdToDbId.set(String(m.client_id), Number(m.id));
        pending.splice(idx, 1);
        continue;
      }

      const insertRes = (await query({
        query: `
          INSERT INTO q_metrics (
            indicator_id, metric_text, unit_of_measure, parent_metric_id, aggregation, is_total, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        values: [indicatorId, metricText, uom, parentDbId, aggregation, isTotal ? 1 : 0, m.sort_order],
      })) as { insertId?: number };

      const newId = Number(insertRes?.insertId ?? 0);
      if (newId && m.client_id) clientIdToDbId.set(String(m.client_id), newId);
      pending.splice(idx, 1);
    }
  }
}
