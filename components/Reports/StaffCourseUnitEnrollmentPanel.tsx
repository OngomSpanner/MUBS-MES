'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffCourseUnitEnrollmentReport } from '@/lib/hrms/staff-course-unit-enrollment';

function formatCount(n: number): string {
  return n > 0 ? String(n) : '—';
}

export default function StaffCourseUnitEnrollmentPanel() {
  const [report, setReport] = useState<StaffCourseUnitEnrollmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-course-unit-enrollment' });
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffCourseUnitEnrollmentReport);
    } catch (e) {
      console.error('staff-course-unit-enrollment error', e);
      setError('Could not load course unit enrollment data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [genderFilter, pwdFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const resetFilters = () => {
    setGenderFilter('all');
    setPwdFilter('all');
  };

  const filtersAtDefault = genderFilter === 'all' && pwdFilter === 'all';
  const colSpan = 2;

  const buildExportRows = (r: StaffCourseUnitEnrollmentReport) => {
    const body = r.rows.map((row) => [row.courseUnitName, formatCount(row.studentCount)]);
    body.push(['TOTAL', formatCount(r.totals.studentCount)]);
    return body;
  };

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Number of students enrolled per course unit', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
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
      head: [['Course unit', 'No of students']],
      body: buildExportRows(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Course_Unit_Enrollment.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Number of students enrolled per course unit'],
      [],
      ['Course unit', 'No of students'],
      ...buildExportRows(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Course unit enrollment');
    XLSX.writeFile(wb, 'Course_Unit_Enrollment.xlsx');
  };

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            library_books
          </span>
          Number of students enrolled per course unit
        </h5>
        <div className="d-flex gap-2 flex-wrap align-items-center">
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
            <option value="all">All students</option>
            <option value="yes">PwD only</option>
            <option value="no">Non-PwD</option>
            <option value="not_recorded">Not recorded</option>
          </select>
          <button type="button" className="btn btn-sm btn-light border fw-bold" onClick={resetFilters} disabled={loading || filtersAtDefault}>
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

      <div className="table-responsive">
        <table className="table mb-0 staff-course-unit-enrollment-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '320px' }}>
                Course unit
              </th>
              <th className="text-center" style={{ minWidth: '110px' }}>
                No of students
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
            ) : !report || report.rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No course unit enrollment data yet.
                </td>
              </tr>
            ) : (
              <>
                {report.rows.map((row) => (
                  <tr key={row.courseUnitName}>
                    <td className="text-start ps-4 fw-semibold" style={{ fontSize: '.85rem' }}>
                      {row.courseUnitName}
                    </td>
                    <td className="text-center" style={{ fontSize: '.85rem' }}>
                      {formatCount(row.studentCount)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f8fafc' }}>
                  <td className="text-start ps-4 fw-bold" style={{ color: 'var(--mubs-blue)', fontSize: '.85rem' }}>
                    TOTAL
                  </td>
                  <td className="text-center fw-bold" style={{ fontSize: '.85rem' }}>
                    {formatCount(report.totals.studentCount)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

