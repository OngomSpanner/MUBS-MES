'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffStudentRatioReport } from '@/lib/hrms/staff-student-ratio';

export default function StaffStudentRatioPanel() {
  const [report, setReport] = useState<StaffStudentRatioReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [programmeFilter, setProgrammeFilter] = useState('All Programmes');
  const [genderFilter, setGenderFilter] = useState('all');
  const [pwdFilter, setPwdFilter] = useState('all');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-student-ratio' });
      if (facultyFilter !== 'All Faculties') params.set('faculty', facultyFilter);
      if (departmentFilter !== 'All Departments') params.set('department', departmentFilter);
      if (programmeFilter !== 'All Programmes') params.set('programme', programmeFilter);
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (pwdFilter !== 'all') params.set('pwd', pwdFilter);
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffStudentRatioReport);
    } catch (e) {
      console.error('staff-student-ratio error', e);
      setError('Could not load staff to student ratio data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [facultyFilter, departmentFilter, programmeFilter, genderFilter, pwdFilter]);

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
    setProgrammeFilter('All Programmes');
    setGenderFilter('all');
    setPwdFilter('all');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    programmeFilter === 'All Programmes' &&
    genderFilter === 'all' &&
    pwdFilter === 'all';

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Staff to student ratio by programme', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Programmes: ${report.totals.programmeCount}`, 14, metaY);
    metaY += 6;
    doc.text(`Teaching staff (distinct): ${report.totals.staffCount}`, 14, metaY);
    metaY += 6;
    doc.text(`Students: ${report.totals.studentCount.toLocaleString()}`, 14, metaY);
    metaY += 6;
    doc.text(`Overall ratio: ${report.totals.ratioLabel}`, 14, metaY);
    metaY += 6;

    autoTable(doc, {
      startY: metaY + 4,
      head: [['Programme', 'Faculty', 'Department/Unit', 'Teaching staff', 'Students', 'Ratio (staff : students)']],
      body: report.rows.map((r) => [
        r.programmeName,
        r.facultyName,
        r.departmentName,
        String(r.staffCount),
        String(r.studentCount),
        r.ratioLabel,
      ]),
      foot: [
        [
          'TOTAL',
          '',
          '',
          String(report.totals.staffCount),
          String(report.totals.studentCount),
          report.totals.ratioLabel,
        ],
      ],
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    });

    doc.save('Staff_Student_Ratio_By_Programme.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Staff to student ratio by programme'],
      ['Programmes', report.totals.programmeCount],
      ['Teaching staff (distinct)', report.totals.staffCount],
      ['Students', report.totals.studentCount],
      ['Overall ratio (staff : students)', report.totals.ratioLabel],
      [],
      ['Programme', 'Faculty', 'Department/Unit', 'Teaching staff', 'Students', 'Ratio (staff : students)'],
      ...report.rows.map((r) => [
        r.programmeName,
        r.facultyName,
        r.departmentName,
        r.staffCount,
        r.studentCount,
        r.ratioLabel,
      ]),
      [],
      ['TOTAL', '', '', report.totals.staffCount, report.totals.studentCount, report.totals.ratioLabel],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff-Student Ratio');
    XLSX.writeFile(wb, 'Staff_Student_Ratio_By_Programme.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const programmes = report?.filterOptions.programmes ?? ['All Programmes'];

  const colSpan = 6;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            school
          </span>
          Staff to student ratio by programme
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
            value={programmeFilter}
            onChange={(e) => setProgrammeFilter(e.target.value)}
            aria-label="Programme"
          >
            {programmes.map((p) => (
              <option key={p} value={p}>
                {p}
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

      {report && !loading && !error && (
        <div className="px-4 py-2 border-bottom bg-light small d-flex flex-wrap gap-3">
          <span>
            <span className="text-muted">Programmes:</span>{' '}
            <strong>{report.totals.programmeCount.toLocaleString()}</strong>
          </span>
          <span>
            <span className="text-muted">Teaching staff:</span>{' '}
            <strong>{report.totals.staffCount.toLocaleString()}</strong>
            <span className="text-muted"> (distinct)</span>
          </span>
          <span>
            <span className="text-muted">Students:</span>{' '}
            <strong>{report.totals.studentCount.toLocaleString()}</strong>
          </span>
          <span>
            <span className="text-muted">Overall ratio:</span> <strong>{report.totals.ratioLabel}</strong>
            <span className="text-muted"> (1 staff member per N students)</span>
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-student-ratio-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '220px' }}>
                Programme
              </th>
              <th className="text-start" style={{ minWidth: '180px' }}>
                Faculty
              </th>
              <th className="text-start" style={{ minWidth: '180px' }}>
                Department/Unit
              </th>
              <th className="text-center" style={{ minWidth: '110px' }}>
                Teaching staff
              </th>
              <th className="text-center" style={{ minWidth: '100px' }}>
                Students
              </th>
              <th className="text-center pe-4" style={{ minWidth: '140px' }}>
                Ratio (1 : N)
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
                  No programme data for the selected filters. Add programme enrollment (Registrar) and lecturer programme assignments.
                </td>
              </tr>
            ) : (
              <>
                {report.rows.map((r) => (
                  <tr key={r.programmeName}>
                    <td className="text-start ps-4 fw-semibold" style={{ fontSize: '.85rem' }}>
                      {r.programmeName}
                    </td>
                    <td className="text-start" style={{ fontSize: '.85rem' }}>
                      {r.facultyName}
                    </td>
                    <td className="text-start" style={{ fontSize: '.85rem' }}>
                      {r.departmentName}
                    </td>
                    <td className="text-center fw-bold" style={{ fontSize: '.85rem' }}>
                      {r.staffCount.toLocaleString()}
                    </td>
                    <td className="text-center fw-bold" style={{ fontSize: '.85rem' }}>
                      {r.studentCount.toLocaleString()}
                    </td>
                    <td className="text-center pe-4" style={{ fontSize: '.85rem' }}>
                      {r.ratioLabel}
                    </td>
                  </tr>
                ))}
                <tr className="table-light fw-bold">
                  <td className="text-start ps-4" colSpan={3}>
                    Total
                  </td>
                  <td className="text-center">{report.totals.staffCount.toLocaleString()}</td>
                  <td className="text-center">{report.totals.studentCount.toLocaleString()}</td>
                  <td className="text-center pe-4">{report.totals.ratioLabel}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
