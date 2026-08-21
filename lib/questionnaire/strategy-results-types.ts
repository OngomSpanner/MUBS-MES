import type { ResultFormulaOperand, ResultOperation } from '@/lib/questionnaire/result-formulas-constants';
import type { PerformanceStatus } from '@/lib/results-framework';

export type StrategyResultMethod = 'sum' | 'single' | 'entered_percent' | 'entered_ratio' | 'not_numeric';

export type StrategyFyCell = {
  target: string | null;
  actual: number | null;
  display: string | null;
  pctOfTarget: number | null;
  performance: PerformanceStatus | null;
  officesWithValues: number;
  method: StrategyResultMethod;
  note: string | null;
};

export type StrategyMetricOption = {
  id: number;
  metricText: string;
  unitOfMeasure: string;
  isInput: boolean;
};

export type StrategyIndicatorResult = {
  indicatorId: number;
  indicatorText: string;
  outcomeLabel: string;
  outcomeType: string;
  strategicPillar: string | null;
  pillarCode: string | null;
  assignedOffices: number;
  offices: Array<{ id: number; name: string }>;
  method: StrategyResultMethod;
  metrics: StrategyMetricOption[];
  byFy: Record<string, StrategyFyCell>;
  suggested: Array<{ operation: ResultOperation; label: string; operands: ResultFormulaOperand[] }>;
};

export type StrategyFormulaResult = {
  id: number;
  name: string;
  operation: ResultOperation;
  operands: ResultFormulaOperand[];
  compareIndicatorId: number | null;
  byFy: Record<string, StrategyFyCell>;
};

export type StrategyResultsPayload = {
  financialYears: string[];
  indicators: StrategyIndicatorResult[];
  formulas: StrategyFormulaResult[];
  approvedOnly: boolean;
};
