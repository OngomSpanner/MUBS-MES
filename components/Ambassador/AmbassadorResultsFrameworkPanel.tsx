'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import ResultsFrameworkMatrixTable from '@/components/Reports/ResultsFrameworkMatrixTable';
import { defaultResultsFrameworkFy } from '@/components/ResultsFramework/ResultsFrameworkFyFilter';
import RfNarrativeModal from '@/components/ResultsFramework/RfNarrativeModal';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import type { AmbassadorResultsFrameworkMatrixRow } from '@/lib/results-framework-query';

export default function AmbassadorResultsFrameworkPanel() {
  const financialYear = defaultResultsFrameworkFy();
  const [managedUnitName, setManagedUnitName] = useState('');
  const [rows, setRows] = useState<AmbassadorResultsFrameworkMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [narrativeRow, setNarrativeRow] = useState<AmbassadorResultsFrameworkMatrixRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/ambassador/results-framework', {
        params: { financialYear: defaultResultsFrameworkFy() },
      });
      setManagedUnitName(res.data.managedUnitName ?? '');
      setRows(res.data.rows ?? []);
    } catch {
      setError('Failed to load Results Framework indicators.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingNarratives = rows.filter((r) => r.needsAmbassadorNarrative).length;

  return (
    <div className="table-card p-3 p-md-4 mb-4">
      <ReportsSectionHeader
        icon="analytics"
        title="Results Framework"
        count={rows.length}
        description={
          <>
            Targets and actuals for <strong>{managedUnitName || 'your unit'}</strong> across the
            strategic plan period. Status for <strong>FY {financialYear}</strong> compares actuals to
            targets (underperformance, achievement, overachievement). When assessed, record the outcome
            explanation and — if on or above target — whether success came from existing practice or
            innovation.
          </>
        }
        filters={
          <button
            type="button"
            className="btn btn-sm btn-light border fw-bold"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        }
      />

      {pendingNarratives > 0 ? (
        <div className="alert alert-warning py-2 small mb-3">
          {pendingNarratives} indicator{pendingNarratives === 1 ? '' : 's'} require an ambassador outcome
          narrative for FY {financialYear}.
        </div>
      ) : null}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <ResultsFrameworkMatrixTable
          rows={rows}
          showResponsibleOffice={false}
          showStatus
          statusFyLabel={financialYear}
          showNarratives
          canRecordNarrative
          onRecordNarrative={setNarrativeRow}
        />
      )}

      <RfNarrativeModal
        key={narrativeRow?.id ?? 'closed'}
        show={narrativeRow != null}
        row={narrativeRow}
        financialYear={financialYear}
        onHide={() => setNarrativeRow(null)}
        onSaved={load}
      />
    </div>
  );
}
