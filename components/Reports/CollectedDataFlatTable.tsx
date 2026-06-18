'use client';

import { Fragment, useMemo } from 'react';

export type CollectedDataRow = {
  key: string;
  indicatorId: number;
  indicatorText: string;
  departmentId: number;
  departmentName: string;
  metricId: number;
  metricText: string;
};

type Props = {
  rows: CollectedDataRow[];
  financialYears: string[];
  getValue: (row: CollectedDataRow, fy: string) => string | null;
};

type DepartmentGroup = {
  departmentId: number;
  departmentName: string;
  rows: CollectedDataRow[];
};

function groupByDepartment(rows: CollectedDataRow[]): DepartmentGroup[] {
  const groups: DepartmentGroup[] = [];
  const indexByDept = new Map<number, number>();

  for (const row of rows) {
    const existing = indexByDept.get(row.departmentId);
    if (existing !== undefined) {
      groups[existing].rows.push(row);
    } else {
      indexByDept.set(row.departmentId, groups.length);
      groups.push({
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        rows: [row],
      });
    }
  }

  return groups;
}

export default function CollectedDataFlatTable({ rows, financialYears, getValue }: Props) {
  const departmentGroups = useMemo(() => groupByDepartment(rows), [rows]);
  const colSpan = 3 + financialYears.length;

  if (rows.length === 0) {
    return <p className="text-muted small mb-0">No metrics match the selected filters.</p>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.78rem' }}>
        <thead className="table-dark">
          <tr>
            <th style={{ width: '30px' }}>#</th>
            <th>Indicator</th>
            <th>Metric</th>
            {financialYears.map((fy) => (
              <th key={fy} className="text-center" style={{ width: '90px' }}>
                {fy}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {departmentGroups.map((group, groupIndex) => (
            <Fragment key={group.departmentId}>
              {groupIndex > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colSpan} style={{ padding: 0, border: 'none', height: '8px', background: '#f8fafc' }} />
                </tr>
              )}
              <tr style={{ background: '#f0f4f9' }}>
                <td
                  colSpan={colSpan}
                  className="fw-semibold small text-primary py-2 px-3"
                  style={{ borderBottom: '2px solid #dee2e6' }}
                >
                  {group.departmentName}
                </td>
              </tr>
              {group.rows.map((row, i) => (
                <tr key={row.key}>
                  <td className="text-center fw-bold" style={{ color: 'var(--mubs-gold, #C8922A)' }}>
                    {i + 1}
                  </td>
                  <td className="small">{row.indicatorText}</td>
                  <td>{row.metricText}</td>
                  {financialYears.map((fy) => {
                    const val = getValue(row, fy);
                    return (
                      <td
                        key={fy}
                        className={`text-center ${val ? 'fw-semibold' : 'text-muted'}`}
                        style={{ fontSize: '0.72rem', fontStyle: val ? 'normal' : 'italic' }}
                      >
                        {val ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
