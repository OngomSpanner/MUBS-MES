'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffEstablishmentReport } from '@/lib/hrms/staff-establishment';

const GENDER_METRICS = ['male', 'female', 'pwd'] as const;
const GENDER_HEADERS = ['Male', 'Female', 'PWD'] as const;

export default function StaffEstablishmentPanel() {
  const [report, setReport] = useState<StaffEstablishmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [pwdFilter, setPwdFilter] = useState('all');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState('in_service');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-establishment' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      if (employmentStatusFilter !== 'in_service') {
        params.set('employment_status', employmentStatusFilter);
      }
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffEstablishmentReport);
    } catch (e) {
      console.error('staff-establishment error', e);
      setError('Could not load staff establishment data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, pwdFilter, employmentStatusFilter]);

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
    setEmploymentStatusFilter('in_service');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    pwdFilter === 'all' &&
    employmentStatusFilter === 'in_service';

  const formatCount = (n: number) => (n > 0 ? String(n) : '—');

  const yearKeys = report?.yearKeys ?? [];

  const buildTableBody = (r: StaffEstablishmentReport) => {
    const body = r.rows.map((row) => [
      row.designation,
      ...r.yearKeys.flatMap((key) =>
        GENDER_METRICS.map((m) => formatCount(row.byYear[key]?.[m] ?? 0))
      ),
    ]);
    body.push([
      'TOTAL',
      ...r.yearKeys.flatMap((key) =>
        GENDER_METRICS.map((m) => formatCount(r.totals[key]?.[m] ?? 0))
      ),
    ]);
    return body;
  };

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Staff Establishment', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Faculty Name: ${report.facultyName}`, 14, metaY);
    metaY += 6;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 6;
    doc.text(`Number of Staff: ${report.numberOfStaff}`, 14, metaY);
    metaY += 6;
    doc.text(`Employment status: ${report.employmentStatusLabel}`, 14, metaY);
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
          { content: 'Designation', rowSpan: 2, styles: { valign: 'middle' } },
          ...report.yearKeys.map((key) => ({
            content: report.years[key],
            colSpan: 3,
            styles: { halign: 'center' as const },
          })),
        ],
        report.yearKeys.flatMap(() => [...GENDER_HEADERS]),
      ],
      body: buildTableBody(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 70 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === report.rows.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    doc.save('Staff_Establishment.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const headerRow1 = [
      'Designation',
      ...report.yearKeys.flatMap((key) =>
        GENDER_HEADERS.map((h) => `${report.years[key]} ${h}`)
      ),
    ];
    const body = report.rows.map((r) => [
      r.designation,
      ...report.yearKeys.flatMap((key) =>
        GENDER_METRICS.map((m) => r.byYear[key]?.[m] ?? 0)
      ),
    ]);
    body.push([
      'TOTAL',
      ...report.yearKeys.flatMap((key) =>
        GENDER_METRICS.map((m) => report.totals[key]?.[m] ?? 0)
      ),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Employment status', report.employmentStatusLabel],
      ['Number of Staff', report.numberOfStaff],
      [],
      headerRow1,
      ...body,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Establishment');
    XLSX.writeFile(wb, 'Staff_Establishment.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const employmentStatusOptions =
    report?.filterOptions.employmentStatuses ?? [
      { value: 'in_service', label: 'In service (excl. retired, resigned, etc.)' },
      { value: 'active', label: 'Active' },
    ];

  const colSpan = 1 + yearKeys.length * 3;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            groups
          </span>
          Staff Establishment
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
            style={{ width: '220px' }}
            value={employmentStatusFilter}
            onChange={(e) => setEmploymentStatusFilter(e.target.value)}
            aria-label="Employment status"
          >
            {employmentStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
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
            <span className="text-muted">Employment status:</span>{' '}
            <strong>{report.employmentStatusLabel}</strong>
          </span>
          <span>
            <span className="text-muted">Staff in report:</span>{' '}
            <strong>{report.numberOfStaff.toLocaleString()}</strong>
          </span>
          <span className="text-muted">
            {report.syncedStaffCount.toLocaleString()} HR-synced · {report.rows.length} designation
            {report.rows.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-establishment-table">
          <thead>
            <tr>
              <th rowSpan={2} className="text-start ps-4" style={{ minWidth: '220px' }}>
                Designation
              </th>
              {yearKeys.map((key, i) => (
                <th
                  key={key}
                  colSpan={3}
                  className={`text-center ${
                    i === 0 ? 'establishment-year-band-prev' : 'establishment-year-band-current'
                  } ${i > 0 ? 'establishment-year-divider' : ''}`}
                >
                  {report?.years[key] ?? key}
                </th>
              ))}
            </tr>
            <tr>
              {yearKeys.map((key, i) =>
                GENDER_HEADERS.map((label, j) => (
                  <th
                    key={`${key}-${label}`}
                    className={`text-center ${
                      i === 0 ? 'establishment-year-prev' : 'establishment-year-current'
                    } ${i > 0 && j === 0 ? 'establishment-year-divider' : ''}`}
                  >
                    {label}
                  </th>
                ))
              )}
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
            ) : !report || report.rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No staff match the selected filters.
                </td>
              </tr>
            ) : (
              <>
                {report.rows.map((row) => (
                  <tr key={row.designation}>
                    <td className="fw-bold text-dark ps-4" style={{ fontSize: '.85rem' }}>
                      {row.designation}
                    </td>
                    {report.yearKeys.map((key, i) =>
                      GENDER_METRICS.map((m, j) => (
                        <td
                          key={`${key}-${m}`}
                          className={`text-center ${
                            i === 0 ? 'establishment-year-prev' : 'establishment-year-current'
                          } ${i > 0 && j === 0 ? 'establishment-year-divider' : ''}`}
                          style={{ fontSize: '.83rem' }}
                        >
                          {row.byYear[key]?.[m] || '—'}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
                <tr className="establishment-total-row">
                  <td className="ps-4" style={{ color: 'var(--mubs-blue)' }}>
                    TOTAL
                  </td>
                  {report.yearKeys.map((key, i) =>
                    GENDER_METRICS.map((m, j) => (
                      <td
                        key={`total-${key}-${m}`}
                        className={`text-center ${
                          i === 0 ? 'establishment-year-prev' : 'establishment-year-current'
                        } ${i > 0 && j === 0 ? 'establishment-year-divider' : ''}`}
                      >
                        {report.totals[key]?.[m] || '—'}
                      </td>
                    ))
                  )}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {report && !loading && !error && (
        <div className="table-card-footer">
          <span className="footer-label">
            {report.rows.length} designation{report.rows.length === 1 ? '' : 's'} ·{' '}
            {report.numberOfStaff.toLocaleString()} staff in current filter
          </span>
        </div>
      )}
    </div>
  );
}
