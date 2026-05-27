'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffDevelopmentReport } from '@/lib/hrms/staff-development';

const PAGE_SIZE = 15;
const REPORT_TITLE = 'Staff Development';
const YEAR_FIELD_HEADERS = ['Education level', 'Programme', 'Gender', 'PwD'] as const;
const YEAR_FIELDS = ['educationLevel', 'programme', 'gender', 'pwd'] as const;

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

export default function StaffDevelopmentPanel() {
  const [report, setReport] = useState<StaffDevelopmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [staffTypeFilter, setStaffTypeFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-development' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (staffTypeFilter !== 'all') params.set('staff_type', staffTypeFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      if (academicYearFilter) params.set('academic_year', academicYearFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffDevelopmentReport);
      setPage(1);
    } catch (e) {
      console.error('staff-development error', e);
      setError('Could not load staff development data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, staffTypeFilter, pwdFilter, academicYearFilter]);

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

  const defaultAcademicYearKey = useMemo(() => {
    const years = report?.filterOptions.academicYears ?? [];
    return years.length > 0 ? years[years.length - 1].key : '';
  }, [report?.filterOptions.academicYears]);

  const resetFilters = () => {
    setFacultyFilter('All Faculties');
    setDepartmentFilter('All Departments');
    setStaffTypeFilter('all');
    setPwdFilter('all');
    setAcademicYearFilter('');
  };

  const effectiveAcademicYear =
    academicYearFilter || report?.selectedYearKey || defaultAcademicYearKey;

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    staffTypeFilter === 'all' &&
    pwdFilter === 'all' &&
    (academicYearFilter === '' || academicYearFilter === defaultAcademicYearKey);

  const yearKeys = report?.yearKeys ?? [];
  const rows = report?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const colSpan = 2 + yearKeys.length * YEAR_FIELD_HEADERS.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const buildFlatHeaders = (r: StaffDevelopmentReport) => [
    'Staff name',
    'Staff type',
    ...YEAR_FIELD_HEADERS.map((h) => `${r.academicYearName} — ${h}`),
  ];

  const buildExportBody = (r: StaffDevelopmentReport) => {
    const key = r.yearKeys[0];
    return r.rows.map((row) => {
      const cell = key ? row.byYear[key] : undefined;
      return [
        row.staffName,
        row.staffType,
        ...YEAR_FIELDS.map((field) => cell?.[field] ?? '—'),
      ];
    });
  };

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
    metaY += 5;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 5;
    doc.text(`Staff type: ${report.staffTypeName}`, 14, metaY);
    metaY += 5;
    doc.text(`Academic year: ${report.academicYearName}`, 14, metaY);
    metaY += 5;
    doc.text(`No of staff recommended for staff development: ${report.recommendedCount}`, 14, metaY);
    metaY += 5;
    doc.text(`Staff in training programmes: ${report.numberOfStaff}`, 14, metaY);
    metaY += 5;
    const impl = report.trainingImplementation[0];
    doc.text(`Trainings completed: ${impl?.completed ?? 0}`, 14, metaY);
    metaY += 5;
    doc.text(`Trainings ongoing: ${impl?.ongoing ?? 0}`, 14, metaY);

    autoTable(doc, {
      startY: metaY + 6,
      head: [buildFlatHeaders(report)],
      body: buildExportBody(report),
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Staff_Development.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const impl = report.trainingImplementation[0];

    const ws = XLSX.utils.aoa_to_sheet([
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Staff type', report.staffTypeName],
      ['Academic year', report.academicYearName],
      ['No of staff recommended for staff development', report.recommendedCount],
      ['Staff in training programmes', report.numberOfStaff],
      ['Trainings completed', impl?.completed ?? 0],
      ['Trainings ongoing', impl?.ongoing ?? 0],
      [],
      buildFlatHeaders(report),
      ...buildExportBody(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Development');
    XLSX.writeFile(wb, 'Staff_Development.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const staffTypeOptions = report?.filterOptions.staffTypes ?? [
    { value: 'all', label: 'All staff types' },
    { value: 'teaching', label: 'Teaching' },
    { value: 'non_teaching', label: 'Non-teaching' },
  ];
  const academicYearOptions = report?.filterOptions.academicYears ?? [];
  const displayYearKey = yearKeys[0];
  const trainingForYear = report?.trainingImplementation[0];
  const trainingsCompleted = trainingForYear?.completed ?? 0;
  const trainingsOngoing = trainingForYear?.ongoing ?? 0;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            school
          </span>
          Staff Development
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
            value={effectiveAcademicYear}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            aria-label="Academic year"
            disabled={academicYearOptions.length === 0}
          >
            {academicYearOptions.map((y) => (
              <option key={y.key} value={y.key}>
                AY {y.label}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: '170px' }}
            value={staffTypeFilter}
            onChange={(e) => setStaffTypeFilter(e.target.value)}
            aria-label="Teaching or non-teaching staff"
          >
            {staffTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
            <span className="text-muted">Staff type:</span>{' '}
            <strong>{report.staffTypeName}</strong>
          </span>
          <span>
            <span className="text-muted">Academic year:</span>{' '}
            <strong>{report.academicYearName}</strong>
          </span>
          <span>
            <span className="text-muted">Recommended for development:</span>{' '}
            <strong>{report.recommendedCount.toLocaleString()}</strong>
          </span>
          <span>
            <span className="text-muted">In training programmes:</span>{' '}
            <strong>{report.numberOfStaff.toLocaleString()}</strong>
          </span>
          <span>
            <span className="text-muted">Trainings completed:</span>{' '}
            <strong>{trainingsCompleted.toLocaleString()}</strong>
          </span>
          <span>
            <span className="text-muted">Trainings ongoing:</span>{' '}
            <strong>{trainingsOngoing.toLocaleString()}</strong>
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-development-table">
          <thead>
            <tr>
              <th className="text-start ps-4 staff-dev-name-col">Name</th>
              <th className="text-center staff-dev-type-col">Staff type</th>
              {YEAR_FIELD_HEADERS.map((label) => (
                <th key={label} className="text-center staff-dev-subhead">
                  {label}
                </th>
              ))}
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
                  No staff with recorded training participation match the selected filters. Add entries in M&amp;E
                  (programme, education level, or training status completed/ongoing).
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr key={`${row.staffName}-${row.staffType}-${(page - 1) * PAGE_SIZE + idx}`}>
                  <td className="fw-bold text-dark ps-4" style={{ fontSize: '.85rem' }}>
                    {row.staffName}
                  </td>
                  <td className="text-center text-muted" style={{ fontSize: '.8rem' }}>
                    {row.staffType}
                  </td>
                  {YEAR_FIELDS.map((field) => (
                    <td
                      key={`${row.staffName}-${displayYearKey}-${field}`}
                      className="text-center"
                      style={{ fontSize: '.8rem' }}
                    >
                      {displayYearKey ? (row.byYear[displayYearKey]?.[field] ?? '—') : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {report && !loading && !error && (
        <div className="table-card-footer">
          <span className="footer-label">
            Showing {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} training participants
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
