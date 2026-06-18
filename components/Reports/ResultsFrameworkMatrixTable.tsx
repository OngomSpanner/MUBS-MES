'use client';

import { Fragment } from 'react';
import { formatActivityMeasuredValue } from '@/lib/activity-unit-of-measure';
import { RF_MATRIX_BASELINE, RF_MATRIX_FY_COLUMNS } from '@/lib/results-framework-matrix';
import type { ResultsFrameworkMatrixRow } from '@/lib/results-framework-matrix';

type Props = {
  rows: ResultsFrameworkMatrixRow[];
};

function cell(value: number | null, unitOfMeasure: string | null): string {
  return formatActivityMeasuredValue(value, unitOfMeasure);
}

export default function ResultsFrameworkMatrixTable({ rows }: Props) {
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
            <th colSpan={2} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
