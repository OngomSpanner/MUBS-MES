'use client';

import {
  PERFORMANCE_STATUS_LABELS,
  performanceStatusBadgeStyle,
} from '@/lib/results-framework';
import { formatActivityMeasuredValue } from '@/lib/activity-unit-of-measure';
import type { MappedResultsFrameworkRow } from '@/lib/results-framework-query';

export type ResultsFrameworkIndicatorRow = MappedResultsFrameworkRow;

type Props = {
  indicators: ResultsFrameworkIndicatorRow[];
  financialYear?: string;
  showNarratives?: boolean;
  onRecordNarrative?: (row: ResultsFrameworkIndicatorRow) => void;
  canRecordNarrative?: boolean;
};

export default function ResultsFrameworkTable({
  indicators,
  financialYear,
  showNarratives = true,
  onRecordNarrative,
  canRecordNarrative = false,
}: Props) {
  const targetHeader = financialYear ? `Target (${financialYear})` : 'Target';
  if (indicators.length === 0) {
    return (
      <div className="text-center py-5 px-3">
        <span className="material-symbols-outlined d-block mb-2 text-muted" style={{ fontSize: '2.5rem', opacity: 0.4 }}>
          analytics
        </span>
        <p className="text-muted small mb-0">No KPI-linked strategic activities found.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th className="small text-muted">Activity</th>
            <th className="small text-muted">Department</th>
            <th className="small text-muted">Expected outcome</th>
            <th className="small text-muted">{targetHeader}</th>
            <th className="small text-muted">Actual</th>
            <th className="small text-muted">Status</th>
            {showNarratives ? <th className="small text-muted">Outcome narrative</th> : null}
            {canRecordNarrative ? <th className="small text-muted" /> : null}
          </tr>
        </thead>
        <tbody>
          {indicators.map((row) => {
            const badge = performanceStatusBadgeStyle(row.performanceStatus);
            return (
              <tr
                key={row.id}
                className={row.needsAmbassadorNarrative ? 'table-warning' : undefined}
              >
                <td>
                  <div className="fw-semibold">{row.title}</div>
                </td>
                <td className="small">{row.departmentName}</td>
                <td className="small text-muted" style={{ maxWidth: '200px' }}>
                  {row.expectedOutcome || '—'}
                </td>
                <td className="small">{formatActivityMeasuredValue(row.targetValue, row.unitOfMeasure)}</td>
                <td className="small">{formatActivityMeasuredValue(row.actualValue, row.unitOfMeasure)}</td>
                <td>
                  <span
                    className="badge"
                    style={{ background: badge.bg, color: badge.color, fontSize: '0.65rem' }}
                  >
                    {row.performanceStatus
                      ? PERFORMANCE_STATUS_LABELS[row.performanceStatus]
                      : row.performanceStatusLabel}
                  </span>
                </td>
                {showNarratives ? (
                  <td className="small" style={{ maxWidth: '280px' }}>
                    {row.outcomeReason ? (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{row.outcomeReason}</div>
                        {row.practiceTypeLabel ? (
                          <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                            {row.practiceTypeLabel}
                            {row.narrativeSource ? ` · ${row.narrativeSource === 'ambassador' ? 'Ambassador' : 'Staff'}` : ''}
                          </div>
                        ) : row.narrativeSource ? (
                          <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                            Source: {row.narrativeSource === 'ambassador' ? 'Ambassador' : 'Staff'}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ) : null}
                {canRecordNarrative ? (
                  <td className="text-end">
                    <button
                      type="button"
                      className={`btn btn-sm fw-bold ${row.needsAmbassadorNarrative ? 'btn-warning' : 'btn-outline-primary'}`}
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => onRecordNarrative?.(row)}
                    >
                      {row.ambassadorNarrativeRecorded
                        ? 'Edit'
                        : row.needsAmbassadorNarrative
                          ? 'Required'
                          : 'Record'}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
