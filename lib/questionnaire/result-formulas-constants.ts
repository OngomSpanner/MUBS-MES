export const RESULT_OPERATIONS = ['sum', 'divide', 'percent', 'share', 'ratio', 'mean'] as const;
export type ResultOperation = (typeof RESULT_OPERATIONS)[number];

export const RESULT_OPERATION_LABELS: Record<ResultOperation, string> = {
  sum: 'Addition (A + B)',
  divide: 'Division (A ÷ B)',
  percent: 'Percentage (A ÷ B × 100)',
  share: 'Share of total (A ÷ (A + B) × 100)',
  ratio: 'Ratio (A:B as n:1)',
  mean: 'Mean ((A + B) ÷ 2)',
};

export type ResultFormulaOperand = {
  indicatorId: number;
  /** Null means the indicator’s numeric total (sum of input metrics). */
  metricId: number | null;
};

export function parseResultOperation(raw: unknown): ResultOperation | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (RESULT_OPERATIONS as readonly string[]).includes(s) ? (s as ResultOperation) : null;
}
