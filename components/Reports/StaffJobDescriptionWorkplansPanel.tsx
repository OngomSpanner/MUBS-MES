'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffJobDescriptionWorkplansReport } from '@/lib/hrms/staff-job-description-workplans';

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}%`;
}

export default function StaffJobDescriptionWorkplansPanel() {
  const [report, setReport] = useState<StaffJobDescriptionWorkplansReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [genderFilter, setGenderFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-job-description-workplans' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffJobDescriptionWorkplansReport);
    } catch (e) {
      console.error('staff-job-description-workplans error', e);
      setError('Could not load job description/workplans data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, genderFilter, pwdFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const departmentOptions = useMemo(() => {
    if (!report) return ['All Departments'];
    if (facultyFilter === 'All Faculties') return report.filterOptions.departments;
    const underFaculty = report.filterOptions.departmentsByFaculty[facultyFilter] ?? [];
    return ['All Departments', ...underFaculty];
  }, [report, facultyFilter]);

  useEffect(() => {
    if (facultyFilter === 'All Faculties') return;
    if (departmentFilter === 'All Departments') return;
    if (!departmentOptions.includes(departmentFilter)) setDepartmentFilter('All Departments');
  }, [facultyFilter, departmentFilter, departmentOptions]);

  const handleFacultyChange = (value: string) => {
    setFacultyFilter(value);
    setDepartmentFilter('All Departments');
  };

  const resetFilters = () => {
    setFacultyFilter('All Faculties');
    setDepartmentFilter('All Departments');
    setGenderFilter('all');
    setPwdFilter('all');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    genderFilter === 'all' &&
    pwdFilter === 'all';

  const yearKeys = report?.yearKeys ?? [];
  const colSpan = 1 + yearKeys.length;

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('% of staff with updated job description and workplans', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Faculty Name: ${report.facultyName}`, 14, metaY);
    metaY += 6;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 6;
    doc.text(`Number of Staff: ${report.numberOfStaff}`, 14, metaY);
    metaY += 6;

    if (genderFilter !== 'all') {
      doc.text(`Gender filter: ${genderFilter === 'male' ? 'Male' : 'Female'}`, 14, metaY);
      metaY += 6;
    }

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

    autoTable(doc, {
      startY: metaY + 4,
      head: [['', ...report.yearKeys.map((k) => report.years[k] ?? k)]],
      body: [[
        '% updated job description and workplans',
        ...report.yearKeys.map((k) => formatPct(report.byYear[k])),
      ]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Staff_Job_Description_Workplans.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['% of staff with updated job description and workplans'],
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Number of Staff', report.numberOfStaff],
      [],
      ['', ...report.yearKeys.map((k) => report.years[k] ?? k)],
      ['% updated job description and workplans', ...report.yearKeys.map((k) => formatPct(report.byYear[k]))],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Job description & workplans');
    XLSX.writeFile(wb, 'Staff_Job_Description_Workplans.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            description
          </span>
          % of staff with updated job description and workplans
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
            style={{ width: '120px' }}
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            aria-label="Filter by gender"
          >
            <option value="all">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
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
          <button type="button" className="btn btn-sm btn-outline-secondary fw-bold" onClick={fetchReport} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={exportPDF} disabled={!report || loading}>
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
            <span className="text-muted">Faculty:</span> <strong>{report.facultyName}</strong>
          </span>
          <span>
            <span className="text-muted">Department/Unit:</span> <strong>{report.departmentName}</strong>
          </span>
          <span>
            <span className="text-muted">Staff in report:</span>{' '}
            <strong>{report.numberOfStaff.toLocaleString()}</strong>
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-job-description-workplans-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '260px' }}>
                %
              </th>
              {yearKeys.map((key, i) => (
                <th
                  key={key}
                  className={`text-center ${
                    i === 0 ? 'establishment-year-band-prev' : 'establishment-year-band-current'
                  } ${i > 0 ? 'establishment-year-divider' : ''}`}
                  style={{ color: 'var(--mubs-blue)', fontWeight: 800, minWidth: '90px' }}
                >
                  {report?.years[key] ?? key}
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
            ) : !report ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No data available.
                </td>
              </tr>
            ) : (
              <tr>
                <td className="text-start ps-4 fw-semibold" style={{ fontSize: '.85rem' }}>
                  % updated job description and workplans
                </td>
                {report.yearKeys.map((key, i) => (
                  <td
                    key={key}
                    className={`text-center ${i > 0 ? 'establishment-year-divider' : ''}`}
                    style={{ fontSize: '.85rem' }}
                  >
                    {formatPct(report.byYear[key])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

