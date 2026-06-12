'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ResultsFrameworkTable, {
  type ResultsFrameworkIndicatorRow,
} from '@/components/ResultsFramework/ResultsFrameworkTable';
import ResultsFrameworkSummaryCards from '@/components/ResultsFramework/ResultsFrameworkSummaryCards';
import ResultsFrameworkFyFilter, {
  defaultResultsFrameworkFy,
} from '@/components/ResultsFramework/ResultsFrameworkFyFilter';
import type { ResultsFrameworkSummary } from '@/lib/results-framework-query';
import { formatActivityMeasuredValue } from '@/lib/activity-unit-of-measure';
import { PERFORMANCE_STATUS_LABELS } from '@/lib/results-framework';

const EMPTY_SUMMARY: ResultsFrameworkSummary = {
  total: 0,
  assessed: 0,
  notAssessed: 0,
  underperformance: 0,
  achievement: 0,
  overachievement: 0,
  narrativesRecorded: 0,
  narrativesRequired: 0,
  narrativesMissing: 0,
  narrativesComplete: 0,
};

export default function AdminResultsFrameworkPanel() {
  const [financialYear, setFinancialYear] = useState(defaultResultsFrameworkFy);
  const [summary, setSummary] = useState<ResultsFrameworkSummary>(EMPTY_SUMMARY);
  const [indicators, setIndicators] = useState<ResultsFrameworkIndicatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/admin/results-framework', {
        params: { financialYear },
      });
      setSummary(res.data.summary ?? EMPTY_SUMMARY);
      setIndicators(res.data.indicators ?? []);
    } catch {
      setError('Failed to load university-wide Results Framework data.');
      setIndicators([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    load();
  }, [load]);

  const exportExcel = () => {
    const rows = indicators.map((r) => ({
      'Financial year': financialYear,
      Activity: r.title,
      'Expected outcome': r.expectedOutcome || '',
      Indicator: r.performanceIndicator || '',
      Department: r.departmentName,
      Target: formatActivityMeasuredValue(r.targetValue, r.unitOfMeasure),
      Actual: formatActivityMeasuredValue(r.actualValue, r.unitOfMeasure),
      Status: r.performanceStatus ? PERFORMANCE_STATUS_LABELS[r.performanceStatus] : r.performanceStatusLabel,
      'Outcome narrative': r.outcomeReason || '',
      'Practice / innovation': r.practiceTypeLabel || '',
      'Narrative source': r.narrativeSource || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results Framework');
    XLSX.writeFile(wb, `results-framework-${financialYear || 'export'}.xlsx`);
  };

  return (
    <div className="table-card shadow-sm border-0 bg-white mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div className="table-card-header flex-wrap gap-2">
        <div>
          <h5 className="mb-0 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Results Framework — university-wide
          </h5>
          <p className="text-muted small mb-0 mt-1">
            Aggregated target vs actual for Strategy &amp; Projects planning and oversight.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 ms-auto flex-wrap">
          <ResultsFrameworkFyFilter
            value={financialYear}
            onChange={setFinancialYear}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn-outline-success btn-sm fw-bold d-inline-flex align-items-center gap-1"
            onClick={exportExcel}
            disabled={loading || indicators.length === 0}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table_chart</span>
            Export Excel
          </button>
        </div>
      </div>

      <div className="p-3 pt-2">
        {error && <div className="alert alert-danger mb-3 py-2 small">{error}</div>}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <>
            <ResultsFrameworkSummaryCards summary={summary} financialYear={financialYear} />
            <ResultsFrameworkTable indicators={indicators} financialYear={financialYear} />
          </>
        )}
      </div>
    </div>
  );
}
