'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import ResultsFrameworkTable, {
  type ResultsFrameworkIndicatorRow,
} from '@/components/ResultsFramework/ResultsFrameworkTable';
import ResultsFrameworkSummaryCards from '@/components/ResultsFramework/ResultsFrameworkSummaryCards';
import ResultsFrameworkFyFilter, {
  defaultResultsFrameworkFy,
} from '@/components/ResultsFramework/ResultsFrameworkFyFilter';
import RfNarrativeModal from '@/components/ResultsFramework/RfNarrativeModal';
import type { ResultsFrameworkSummary } from '@/lib/results-framework-query';

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

export default function AmbassadorResultsFrameworkPanel() {
  const [managedUnitName, setManagedUnitName] = useState('');
  const [financialYear, setFinancialYear] = useState(defaultResultsFrameworkFy);
  const [summary, setSummary] = useState<ResultsFrameworkSummary>(EMPTY_SUMMARY);
  const [indicators, setIndicators] = useState<ResultsFrameworkIndicatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [narrativeRow, setNarrativeRow] = useState<ResultsFrameworkIndicatorRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/ambassador/results-framework', {
        params: { financialYear },
      });
      setManagedUnitName(res.data.managedUnitName ?? '');
      setSummary(res.data.summary ?? EMPTY_SUMMARY);
      setIndicators(res.data.indicators ?? []);
    } catch {
      setError('Failed to load Results Framework indicators.');
      setIndicators([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div className="table-card-header flex-wrap gap-2">
        <div>
          <h5 className="mb-0 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Results Framework
          </h5>
          <p className="text-muted small mb-0 mt-1">
            Target vs actual for <strong>{managedUnitName || 'your unit'}</strong>. Record outcome narratives as ambassador.
          </p>
        </div>
        <ResultsFrameworkFyFilter
          value={financialYear}
          onChange={setFinancialYear}
          disabled={loading}
        />
      </div>

      <div className="p-3 pt-2">
        {error && <div className="alert alert-danger mb-3 py-2 small">{error}</div>}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <ResultsFrameworkSummaryCards summary={summary} financialYear={financialYear} />
            <ResultsFrameworkTable
              indicators={indicators}
              financialYear={financialYear}
              canRecordNarrative
              onRecordNarrative={setNarrativeRow}
            />
          </>
        )}
      </div>

      <RfNarrativeModal
        show={narrativeRow != null}
        row={narrativeRow}
        financialYear={financialYear}
        onHide={() => setNarrativeRow(null)}
        onSaved={load}
      />
    </div>
  );
}
