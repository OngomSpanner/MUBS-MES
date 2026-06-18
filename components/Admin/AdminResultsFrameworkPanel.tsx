'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ResultsFrameworkMatrixTable from '@/components/Reports/ResultsFrameworkMatrixTable';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import { RF_MATRIX_BASELINE } from '@/lib/results-framework-matrix';
import type { ResultsFrameworkMatrixRow } from '@/lib/results-framework-matrix';
import { formatActivityMeasuredValue } from '@/lib/activity-unit-of-measure';

export default function AdminResultsFrameworkPanel() {
  const [rows, setRows] = useState<ResultsFrameworkMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/admin/results-framework');
      setRows(res.data.rows ?? []);
    } catch {
      setError('Failed to load Results Framework data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportExcel = () => {
    const sheetRows = rows.map((row) => {
      const out: Record<string, string> = {
        'Output / Outcome': row.outcomeOutput,
        Indicator: row.indicator,
        [`Baseline ${RF_MATRIX_BASELINE.label}`]: formatActivityMeasuredValue(
          row.baseline2024_25,
          row.unitOfMeasure,
        ),
      };
      for (const fy of row.fiscalYears) {
        out[`Target ${fy.label}`] = formatActivityMeasuredValue(fy.target, row.unitOfMeasure);
        out[`Actual ${fy.label}`] = formatActivityMeasuredValue(fy.actual, row.unitOfMeasure);
      }
      out.Budget = row.budget ?? '';
      out['Responsible Office'] = row.responsibleOffice;
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results Framework');
    XLSX.writeFile(wb, 'results-framework-matrix.xlsx');
  };

  if (loading) {
    return (
      <div className="table-card p-3 p-md-4 mb-4 text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="table-card p-3 p-md-4 mb-4">
      <ReportsSectionHeader
        icon="analytics"
        title="Results Framework"
        count={rows.length}
        description="University-wide targets and actuals across the strategic plan period."
        filters={
          <>
            <button
              type="button"
              className="btn btn-sm btn-light border fw-bold"
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1"
              onClick={exportExcel}
              disabled={rows.length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                table_chart
              </span>
              Export
            </button>
          </>
        }
      />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <ResultsFrameworkMatrixTable rows={rows} />
    </div>
  );
}
