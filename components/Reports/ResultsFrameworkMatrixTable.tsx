'use client';

import { Fragment } from 'react';
import { formatActivityMeasuredValue } from '@/lib/activity-unit-of-measure';
import {
  PERFORMANCE_STATUS_LABELS,
  performanceStatusBadgeStyle,
} from '@/lib/results-framework';
import { RF_MATRIX_BASELINE, RF_MATRIX_FY_COLUMNS } from '@/lib/results-framework-matrix';
import type { ResultsFrameworkMatrixRow } from '@/lib/results-framework-matrix';
import type { AmbassadorResultsFrameworkMatrixRow } from '@/lib/results-framework-query';

type AmbassadorRow = AmbassadorResultsFrameworkMatrixRow;

type Props = {
  rows: ResultsFrameworkMatrixRow[];
  showStatus?: boolean;
  statusFyLabel?: string;
  showNarratives?: boolean;
  canRecordNarrative?: boolean;
  onRecordNarrative?: (row: AmbassadorRow) => void;
};

function cell(value: number | null, unitOfMeasure: string | null): string {
  return formatActivityMeasuredValue(value, unitOfMeasure);
}

function isAmbassadorRow(row: ResultsFrameworkMatrixRow): row is AmbassadorRow {
  return 'performanceStatusLabel' in row;
}

export default function ResultsFrameworkMatrixTable({
  rows,
  showStatus = false,
  statusFyLabel,
  showNarratives = false,
  canRecordNarrative = false,
  onRecordNarrative,
}: Props) {
  const trailingCols =
    (showStatus ? 1 : 0) + (showNarratives ? 1 : 0) + (canRecordNarrative ? 1 : 0);

  if (rows.length === 0) {
    return (
      <div className="text-center text-muted py-5 small">
        <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2rem' }}>
          analytics
        </span>
        No results framework indicators found.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.72rem' }}>
        <thead className="table-dark">
          <tr>
            <th style={{ minWidth: '180px' }}>Output / Outcome</th>
            <th style={{ minWidth: '160px' }}>Indicator</th>
            <th className="text-center" style={{ minWidth: '88px' }}>
              Baseline
              <div className="fw-normal opacity-75" style={{ fontSize: '0.62rem' }}>
                {RF_MATRIX_BASELINE.label}
              </div>
            </th>
            {RF_MATRIX_FY_COLUMNS.map((fy) => (
              <th key={fy.label} colSpan={2} className="text-center" style={{ minWidth: '120px' }}>
                {fy.label}
              </th>
            ))}
            <th style={{ minWidth: '90px' }}>Budget</th>
            <th style={{ minWidth: '140px' }}>Responsible Office</th>
            {showStatus ? (
              <th className="text-center" style={{ minWidth: '110px' }}>
                Status
                {statusFyLabel ? (
                  <div className="fw-normal opacity-75" style={{ fontSize: '0.62rem' }}>
                    FY {statusFyLabel}
                  </div>
                ) : null}
              </th>
            ) : null}
            {showNarratives ? (
              <th style={{ minWidth: '180px' }}>Outcome narrative</th>
            ) : null}
            {canRecordNarrative ? <th style={{ minWidth: '72px' }} /> : null}
          </tr>
          <tr className="table-secondary">
            <th colSpan={2} />
            <th className="text-center small fw-semibold">Value</th>
            {RF_MATRIX_FY_COLUMNS.map((fy) => (
              <Fragment key={`sub-${fy.label}`}>
                <th className="text-center small fw-semibold">Target</th>
                <th className="text-center small fw-semibold">Actual</th>
              </Fragment>
            ))}
            <th colSpan={2 + trailingCols} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ambassadorRow = isAmbassadorRow(row) ? row : null;
            const badge = ambassadorRow
              ? performanceStatusBadgeStyle(ambassadorRow.performanceStatus)
              : null;

            return (
              <tr
                key={row.id}
                className={ambassadorRow?.needsAmbassadorNarrative ? 'table-warning' : undefined}
              >
                <td className="small">{row.outcomeOutput}</td>
                <td className="small fw-semibold">{row.indicator}</td>
                <td className="text-center">{cell(row.baseline2024_25, row.unitOfMeasure)}</td>
                {row.fiscalYears.map((fy) => (
                  <Fragment key={`${row.id}-${fy.label}`}>
                    <td className="text-center">{cell(fy.target, row.unitOfMeasure)}</td>
                    <td className="text-center">{cell(fy.actual, row.unitOfMeasure)}</td>
                  </Fragment>
                ))}
                <td className="text-center text-muted">{row.budget ?? '—'}</td>
                <td className="small">{row.responsibleOffice}</td>
                {showStatus && ambassadorRow && badge ? (
                  <td className="text-center">
                    <span
                      className="badge"
                      style={{ background: badge.bg, color: badge.color, fontSize: '0.62rem' }}
                    >
                      {ambassadorRow.performanceStatus
                        ? PERFORMANCE_STATUS_LABELS[ambassadorRow.performanceStatus]
                        : ambassadorRow.performanceStatusLabel}
                    </span>
                  </td>
                ) : showStatus ? (
                  <td className="text-center text-muted">—</td>
                ) : null}
                {showNarratives && ambassadorRow ? (
                  <td className="small" style={{ maxWidth: '220px' }}>
                    {ambassadorRow.outcomeReason ? (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{ambassadorRow.outcomeReason}</div>
                        {ambassadorRow.practiceTypeLabel ? (
                          <div className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>
                            {ambassadorRow.practiceTypeLabel}
                            {ambassadorRow.narrativeSource
                              ? ` · ${ambassadorRow.narrativeSource === 'ambassador' ? 'Ambassador' : 'Staff'}`
                              : ''}
                          </div>
                        ) : ambassadorRow.narrativeSource ? (
                          <div className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>
                            Source:{' '}
                            {ambassadorRow.narrativeSource === 'ambassador' ? 'Ambassador' : 'Staff'}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ) : null}
                {canRecordNarrative && ambassadorRow ? (
                  <td className="text-end">
                    <button
                      type="button"
                      className={`btn btn-sm fw-bold ${ambassadorRow.needsAmbassadorNarrative ? 'btn-warning' : 'btn-outline-primary'}`}
                      style={{ fontSize: '0.65rem' }}
                      onClick={() => onRecordNarrative?.(ambassadorRow)}
                    >
                      {ambassadorRow.ambassadorNarrativeRecorded
                        ? 'Edit'
                        : ambassadorRow.needsAmbassadorNarrative
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
