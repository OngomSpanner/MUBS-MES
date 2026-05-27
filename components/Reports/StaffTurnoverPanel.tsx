'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffTurnoverReport, TurnoverStaffRow } from '@/lib/hrms/staff-turnover';

const PAGE_SIZE = 15;
const REPORT_TITLE = 'Staff Turnover Rate';

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const t = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Paginator({
  page,
  total,
  onPrev,
  onNext,
  onPage,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages: (number | 'ellipsis')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
    if (page < total - 2) pages.push('ellipsis');
    pages.push(total);
  }
  return (
    <div className="d-flex gap-1 align-items-center">
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={onPrev}>
        ‹
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={p === page ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= total} onClick={onNext}>
        ›
      </button>
    </div>
  );
}

function exportRowCells(row: TurnoverStaffRow, showReason: boolean): string[] {
  const base = [
    row.staffName,
    row.gender,
    row.pwd,
    row.designation,
    formatDate(row.dateOfAppointment),
    formatDate(row.dateOfSeparation),
  ];
  return showReason ? [row.categoryLabel, ...base] : base;
}

export default function StaffTurnoverPanel() {
  const [report, setReport] = useState<StaffTurnoverReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-turnover' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (reasonFilter !== 'all') params.set('reason', reasonFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffTurnoverReport);
      setPage(1);
    } catch (e) {
      console.error('staff-turnover error', e);
      setError('Could not load staff turnover data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, reasonFilter, pwdFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const departmentOptions = useMemo(() => {
    if (!report) return ['All Departments'];
    if (facultyFilter === 'All Faculties') {
      return report.filterOptions.departments;
    }
    const underFaculty = report.filterOptions.departmentsByFaculty[facultyFilter] ?? [];
    return ['All Departments', ...underFaculty];
  }, [report, facultyFilter]);

  useEffect(() => {
    if (facultyFilter === 'All Faculties') return;
    if (departmentFilter === 'All Departments') return;
    if (!departmentOptions.includes(departmentFilter)) {
      setDepartmentFilter('All Departments');
    }
  }, [facultyFilter, departmentFilter, departmentOptions]);

  const handleFacultyChange = (value: string) => {
    setFacultyFilter(value);
    setDepartmentFilter('All Departments');
  };

  const resetFilters = () => {
    setFacultyFilter('All Faculties');
    setDepartmentFilter('All Departments');
    setReasonFilter('all');
    setPwdFilter('all');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    reasonFilter === 'all' &&
    pwdFilter === 'all';

  const showReasonColumn = reasonFilter === 'all';
  const rows = report?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const exportHeaders = showReasonColumn
    ? ['Reason', 'Staff name', 'Gender', 'PWD', 'Designation', 'Date of appointment', 'Date of separation']
    : ['Staff name', 'Gender', 'PWD', 'Designation', 'Date of appointment', 'Date of separation'];

  const buildExportBody = (r: StaffTurnoverReport) =>
    r.rows.map((row) => exportRowCells(row, showReasonColumn));

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(12);
    doc.text(REPORT_TITLE, 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Faculty Name: ${report.facultyName}`, 14, metaY);
    metaY += 6;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 6;
    doc.text(`Turnover reason: ${report.turnoverReasonName}`, 14, metaY);
    metaY += 6;
    doc.text(`Staff separated: ${report.numberOfStaff}`, 14, metaY);
    metaY += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, metaY);

    autoTable(doc, {
      startY: metaY + 8,
      head: [exportHeaders],
      body: buildExportBody(report),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Staff_Turnover.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      [REPORT_TITLE],
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Turnover reason', report.turnoverReasonName],
      ['Staff separated', report.numberOfStaff],
      [],
      exportHeaders,
      ...buildExportBody(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Turnover');
    XLSX.writeFile(wb, 'Staff_Turnover.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const reasons = report?.filterOptions.reasons ?? [{ value: 'all', label: 'All reasons' }];
  const colSpan = showReasonColumn ? 7 : 6;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            exit_to_app
          </span>
          Staff Turnover
        </h5>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <select
            className="form-select form-select-sm"
            style={{ width: '180px' }}
            value={facultyFilter}
            onChange={(e) => handleFacultyChange(e.target.value)}
            aria-label="Faculty or office"
          >
            {faculties.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: '200px' }}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d === 'All Departments' ? 'All Departments' : d}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: '175px' }}
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            aria-label="Turnover reason"
          >
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: '130px' }}
            value={pwdFilter}
            onChange={(e) => setPwdFilter(e.target.value)}
            aria-label="Filter by PwD status"
          >
            <option value="all">All staff</option>
            <option value="yes">PwD only</option>
            <option value="no">Non-PwD</option>
            <option value="not_recorded">Not recorded</option>
          </select>
          <button
            type="button"
            className="btn btn-sm btn-light border fw-bold"
            onClick={resetFilters}
            disabled={loading || filtersAtDefault}
          >
            Reset Filters
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary fw-bold"
            onClick={fetchReport}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger fw-bold"
            onClick={exportPDF}
            disabled={!report || loading}
          >
            PDF
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary fw-bold"
            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
            onClick={exportExcel}
            disabled={!report || loading}
          >
            <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>
              download
            </span>
            Excel
          </button>
        </div>
      </div>

      {report && !loading && !error && (
        <div className="px-4 py-2 border-bottom bg-light small">
          <div className="fw-bold text-dark mb-2" style={{ fontSize: '.9rem' }}>
            {REPORT_TITLE}
          </div>
          <div className="d-flex flex-wrap gap-3">
            <span>
              <span className="text-muted">Faculty:</span>{' '}
              <strong>{report.facultyName}</strong>
            </span>
            <span>
              <span className="text-muted">Department/Unit:</span>{' '}
              <strong>{report.departmentName}</strong>
            </span>
            <span>
              <span className="text-muted">Reason:</span>{' '}
              <strong>{report.turnoverReasonName}</strong>
            </span>
            <span>
              <span className="text-muted">Staff separated:</span>{' '}
              <strong>{report.numberOfStaff.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-turnover-table">
          <thead>
            <tr>
              {showReasonColumn && (
                <th className="text-center" style={{ minWidth: '140px' }}>
                  Reason
                </th>
              )}
              <th className="text-start ps-3" style={{ minWidth: '200px' }}>
                Staff name
              </th>
              <th className="text-center" style={{ width: '80px' }}>
                Gender
              </th>
              <th className="text-center" style={{ width: '60px' }}>
                PWD
              </th>
              <th className="text-center" style={{ minWidth: '160px' }}>
                Designation
              </th>
              <th className="text-center" style={{ minWidth: '120px' }}>
                Date of appointment
              </th>
              <th className="text-center" style={{ minWidth: '120px' }}>
                Date of separation
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  <div className="alert alert-danger m-3 mb-3">{error}</div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No separated staff match the selected filters.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr key={`${row.category}-${row.staffName}-${idx}`}>
                  {showReasonColumn && (
                    <td className="text-center fw-semibold" style={{ fontSize: '.83rem' }}>
                      {row.categoryLabel}
                    </td>
                  )}
                  <td className="fw-semibold text-dark ps-3" style={{ fontSize: '.85rem' }}>
                    {row.staffName}
                  </td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {row.gender}
                  </td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {row.pwd}
                  </td>
                  <td style={{ fontSize: '.83rem' }}>{row.designation}</td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {formatDate(row.dateOfAppointment)}
                  </td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {formatDate(row.dateOfSeparation)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {report && !loading && !error && rows.length > 0 && (
        <div className="table-card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span className="footer-label">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of{' '}
            {rows.length.toLocaleString()} staff
          </span>
          <Paginator
            page={page}
            total={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
