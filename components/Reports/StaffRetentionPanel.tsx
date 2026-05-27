'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffRetentionReport } from '@/lib/hrms/staff-retention';

const PAGE_SIZE = 15;

function formatYearsDisplay(value: number | null): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

export default function StaffRetentionPanel() {
  const [report, setReport] = useState<StaffRetentionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [pwdFilter, setPwdFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-retention' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffRetentionReport);
      setPage(1);
    } catch (e) {
      console.error('staff-retention error', e);
      setError('Could not load staff retention data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, pwdFilter]);

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
    setPwdFilter('all');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    pwdFilter === 'all';

  const rows = report?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const buildExportRows = (r: StaffRetentionReport) =>
    r.rows.map((row) => [
      row.staffName,
      row.gender,
      row.pwd,
      row.designation,
      formatYearsDisplay(row.yearsServed),
    ]);

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Staff Retention', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Faculty Name: ${report.facultyName}`, 14, metaY);
    metaY += 6;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 6;
    doc.text(`Number of Staff: ${report.numberOfStaff}`, 14, metaY);
    metaY += 6;
    if (pwdFilter !== 'all') {
      const pwdLabel =
        pwdFilter === 'yes'
          ? 'PwD only'
          : pwdFilter === 'no'
            ? 'Non-PwD'
            : 'Disability status not recorded';
      doc.text(`PwD filter: ${pwdLabel}`, 14, metaY);
      metaY += 6;
    }
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, metaY);

    autoTable(doc, {
      startY: metaY + 8,
      head: [
        [
          { content: 'Staff name', rowSpan: 2, styles: { valign: 'middle' } },
          {
            content: 'Number of years served at MUBS',
            colSpan: 4,
            styles: { halign: 'center' },
          },
        ],
        ['Gender', 'PWD', 'Designation', 'No of years'],
      ],
      body: buildExportRows(report),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 55 },
        3: { cellWidth: 55 },
      },
    });

    doc.save('Staff_Retention.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Number of Staff', report.numberOfStaff],
      [],
      ['Staff name', 'Gender', 'PWD', 'Designation', 'No of years'],
      ...buildExportRows(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Retention');
    XLSX.writeFile(wb, 'Staff_Retention.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const colSpan = 5;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            schedule
          </span>
          Staff Retention
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
        <div className="px-4 py-2 border-bottom bg-light small d-flex flex-wrap gap-3">
          <span>
            <span className="text-muted">Faculty:</span>{' '}
            <strong>{report.facultyName}</strong>
          </span>
          <span>
            <span className="text-muted">Department/Unit:</span>{' '}
            <strong>{report.departmentName}</strong>
          </span>
          <span>
            <span className="text-muted">Staff in report:</span>{' '}
            <strong>{report.numberOfStaff.toLocaleString()}</strong>
          </span>
          <span className="text-muted">
            {report.syncedStaffCount.toLocaleString()} HR-synced
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-retention-table">
          <thead>
            <tr>
              <th rowSpan={2} className="text-start ps-4" style={{ minWidth: '200px' }}>
                Staff name
              </th>
              <th colSpan={4} className="text-center staff-retention-years-header">
                Number of years served at MUBS
              </th>
            </tr>
            <tr>
              <th className="text-center">Gender</th>
              <th className="text-center">PWD</th>
              <th className="text-center" style={{ minWidth: '180px' }}>
                Designation
              </th>
              <th className="text-center">No of years</th>
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
                  No staff match the selected filters.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr key={`${row.staffName}-${idx}`}>
                  <td className="fw-bold text-dark ps-4" style={{ fontSize: '.85rem' }}>
                    {row.staffName}
                  </td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {row.gender}
                  </td>
                  <td className="text-center" style={{ fontSize: '.83rem' }}>
                    {row.pwd}
                  </td>
                  <td style={{ fontSize: '.83rem' }}>{row.designation}</td>
                  <td className="text-center fw-semibold" style={{ fontSize: '.83rem' }}>
                    {formatYearsDisplay(row.yearsServed)}
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
          <span className="text-muted" style={{ fontSize: '.72rem' }}>
            Years calculated from date of first appointment (HR sync).
          </span>
        </div>
      )}
    </div>
  );
}
