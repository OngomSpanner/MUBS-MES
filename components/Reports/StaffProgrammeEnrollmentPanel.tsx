'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffProgrammeEnrollmentReport } from '@/lib/hrms/staff-programme-enrollment';

function formatCount(n: number): string {
  return n > 0 ? String(n) : '—';
}

type Props = {
  facultyFilter?: string;
  hideFacultyFilter?: boolean;
};

export default function StaffProgrammeEnrollmentPanel({ facultyFilter: externalFaculty, hideFacultyFilter }: Props = {}) {
  const [report, setReport] = useState<StaffProgrammeEnrollmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');
  const [internalFaculty, setInternalFaculty] = useState('all');
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);

  const facultyFilter = externalFaculty ?? internalFaculty;

  useEffect(() => {
    if (hideFacultyFilter) return;
    axios
      .get('/api/enrollment/faculties')
      .then((res) => {
        const list = Array.isArray(res.data?.faculties) ? res.data.faculties : [];
        setFacultyOptions(list);
      })
      .catch(() => setFacultyOptions([]));
  }, [hideFacultyFilter]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-programme-enrollment' });
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      if (facultyFilter !== 'all') params.set('faculty', facultyFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffProgrammeEnrollmentReport);
    } catch (e) {
      console.error('staff-programme-enrollment error', e);
      setError('Could not load programme enrollment data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [genderFilter, pwdFilter, facultyFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const resetFilters = () => {
    setGenderFilter('all');
    setPwdFilter('all');
    if (!hideFacultyFilter) setInternalFaculty('all');
  };

  const filtersAtDefault =
    genderFilter === 'all' && pwdFilter === 'all' && (hideFacultyFilter || facultyFilter === 'all');
  const colSpan = 3;

  const buildExportRows = (r: StaffProgrammeEnrollmentReport) => {
    const body = r.rows.map((row) => [row.facultyName, row.programmeName, formatCount(row.studentCount)]);
    body.push(['', 'TOTAL', formatCount(r.totals.studentCount)]);
    return body;
  };

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Number of students in each programme', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    if (facultyFilter !== 'all') {
      doc.text(`Faculty filter: ${facultyFilter}`, 14, metaY);
      metaY += 6;
    }
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
      head: [['Faculty / school', 'Programme Name', 'No of students']],
      body: buildExportRows(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Programme_Student_Enrollment.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Number of students in each programme'],
      [],
      ['Faculty / school', 'Programme Name', 'No of students'],
      ...buildExportRows(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programme enrollment');
    XLSX.writeFile(wb, 'Programme_Student_Enrollment.xlsx');
  };

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            groups
          </span>
          Number of students in each programme
        </h5>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {!hideFacultyFilter && (
            <select
              className="form-select form-select-sm"
              style={{ width: '180px' }}
              value={internalFaculty}
              onChange={(e) => setInternalFaculty(e.target.value)}
              aria-label="Filter by faculty"
            >
              <option value="all">All faculties</option>
              {facultyOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
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

      <div className="table-responsive">
        <table className="table mb-0 staff-programme-enrollment-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '160px' }}>
                Faculty / school
              </th>
              <th className="text-start" style={{ minWidth: '220px' }}>
                Programme Name
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
                  No programme enrollment data yet.
                </td>
              </tr>
            ) : (
              <>
                {report.rows.map((row) => (
                  <tr key={`${row.facultyName}-${row.programmeName}`}>
                    <td className="text-start ps-4 text-muted" style={{ fontSize: '.8rem' }}>
                      {row.facultyName}
                    </td>
                    <td className="text-start fw-semibold" style={{ fontSize: '.85rem' }}>
                      {row.programmeName}
                    </td>
                    <td className="text-center" style={{ fontSize: '.85rem' }}>
                      {formatCount(row.studentCount)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f8fafc' }}>
                  <td className="text-start ps-4" />
                  <td className="text-start fw-bold" style={{ color: 'var(--mubs-blue)', fontSize: '.85rem' }}>
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
