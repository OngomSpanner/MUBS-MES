'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

export type SortableColumn = {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: SortableColumn[];
  rowKey: (row: T) => string | number;
  renderRow: (row: T) => ReactNode;
  getSortValue: (row: T, key: string) => string | number;
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  pageSize?: number;
  emptyMessage?: string;
};

function compareValues(a: string | number, b: string | number, dir: SortDir): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const sa = String(a);
  const sb = String(b);
  return dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
}

export default function SortablePaginatedTable<T>({
  rows,
  columns,
  rowKey,
  renderRow,
  getSortValue,
  defaultSortKey,
  defaultSortDir = 'desc',
  pageSize = 25,
  emptyMessage = 'No rows to display.',
}: Props<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows.length, sortKey, sortDir]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareValues(getSortValue(a, sortKey), getSortValue(b, sortKey), sortDir));
    return copy;
  }, [rows, sortKey, sortDir, getSortValue]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'departmentName' || key === 'objective' || key === 'outcome' ? 'asc' : 'desc');
    }
  };

  return (
    <>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.className}
                  style={col.sortable !== false ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                  onClick={col.sortable !== false ? () => toggleSort(col.key) : undefined}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    <span className="ms-1 text-muted">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-muted text-center py-4">{emptyMessage}</td>
              </tr>
            ) : pageRows.map((row) => (
              <tr key={rowKey(row)}>{renderRow(row)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize ? (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 small">
          <span className="text-muted">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="d-flex gap-1 align-items-center">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <span className="px-2">Page {safePage} of {totalPages}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Prefer rows with activity (fill / progress / approvals) then higher fill rate. */
export function sortDepartmentsByProgress<T extends {
  fillRatePct: number;
  approved: number;
  inProgress: number;
  awaitingReview: number;
  completeDraft: number;
  departmentName: string;
}>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const activity = (r: T) => (
      (r.fillRatePct > 0 ? 1 : 0)
      + (r.approved > 0 ? 1 : 0)
      + (r.inProgress > 0 ? 1 : 0)
      + (r.awaitingReview > 0 ? 1 : 0)
      + (r.completeDraft > 0 ? 1 : 0)
    );
    const actDiff = activity(b) - activity(a);
    if (actDiff !== 0) return actDiff;
    if (b.fillRatePct !== a.fillRatePct) return b.fillRatePct - a.fillRatePct;
    if (b.approved !== a.approved) return b.approved - a.approved;
    return a.departmentName.localeCompare(b.departmentName);
  });
}
