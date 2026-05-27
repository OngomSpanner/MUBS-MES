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
  const [courseUnitFilter, setCourseUnitFilter] = useState('All Course Units');
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
      if (courseUnitFilter !== 'All Course Units') params.set('course_unit', courseUnitFilter);
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
  }, [facultyFilter, departmentFilter, programmeFilter, courseUnitFilter, genderFilter, pwdFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const departmentOptions = useMemo(() => {
    if (!report) return ['All Departments'];
    if (facultyFilter === 'All Faculties') return report.filterOptions.departments;
    const underFaculty = report.filterOptions.departmentsByFaculty[facultyFilter] ?? [];
    return ['All Departments', ...underFaculty];
  }, [report, facultyFilter]);

  const courseUnitOptions = useMemo(() => {
    if (!report) return ['All Course Units'];
    if (programmeFilter === 'All Programmes') return report.filterOptions.courseUnits;
    const underProgramme = report.filterOptions.courseUnitsByProgramme[programmeFilter] ?? [];
    return ['All Course Units', ...underProgramme];
  }, [report, programmeFilter]);

  useEffect(() => {
    if (facultyFilter === 'All Faculties') return;
    if (departmentFilter === 'All Departments') return;
    if (!departmentOptions.includes(departmentFilter)) setDepartmentFilter('All Departments');
  }, [facultyFilter, departmentFilter, departmentOptions]);

  useEffect(() => {
    if (programmeFilter === 'All Programmes') return;
    if (courseUnitFilter === 'All Course Units') return;
    if (!courseUnitOptions.includes(courseUnitFilter)) setCourseUnitFilter('All Course Units');
  }, [programmeFilter, courseUnitFilter, courseUnitOptions]);

  const handleFacultyChange = (value: string) => {
    setFacultyFilter(value);
    setDepartmentFilter('All Departments');
  };

  const handleProgrammeChange = (value: string) => {
    setProgrammeFilter(value);
    setCourseUnitFilter('All Course Units');
  };

  const resetFilters = () => {
    setFacultyFilter('All Faculties');
    setDepartmentFilter('All Departments');
    setProgrammeFilter('All Programmes');
    setCourseUnitFilter('All Course Units');
    setGenderFilter('all');
    setPwdFilter('all');
  };

  const filtersAtDefault =
    facultyFilter === 'All Faculties' &&
    departmentFilter === 'All Departments' &&
    programmeFilter === 'All Programmes' &&
    courseUnitFilter === 'All Course Units' &&
    genderFilter === 'all' &&
    pwdFilter === 'all';

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Percentage of staff to student ratio', 14, 15);
    doc.setFontSize(9);
    let metaY = 22;
    doc.text(`Faculty Name: ${report.facultyName}`, 14, metaY);
    metaY += 6;
    doc.text(`Department/Unit Name: ${report.departmentName}`, 14, metaY);
    metaY += 6;
    doc.text(`Programme Name: ${report.programmeName}`, 14, metaY);
    metaY += 6;
    doc.text(`Course Unit Name: ${report.courseUnitName}`, 14, metaY);
    metaY += 6;
    doc.text(`Number of Lecturers: ${report.numberOfLecturers}`, 14, metaY);
    metaY += 6;

    autoTable(doc, {
      startY: metaY + 4,
      head: [['Name of the Lecturer', 'Gender', 'PWD details', 'Qualification', 'Qualification details']],
      body: report.rows.map((r) => [r.lecturerName, r.gender ?? '—', r.pwdDetails ?? '—', r.qualification ?? '—', r.qualificationDetails ?? '—']),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Staff_Student_Ratio.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Percentage of staff to student ratio'],
      ['Faculty Name', report.facultyName],
      ['Department/Unit Name', report.departmentName],
      ['Programme Name', report.programmeName],
      ['Course Unit Name', report.courseUnitName],
      ['Number of Lecturers', report.numberOfLecturers],
      [],
      ['Name of the Lecturer', 'Gender', 'PWD details', 'Qualification', 'Qualification details'],
      ...report.rows.map((r) => [r.lecturerName, r.gender ?? '—', r.pwdDetails ?? '—', r.qualification ?? '—', r.qualificationDetails ?? '—']),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff-Student Ratio');
    XLSX.writeFile(wb, 'Staff_Student_Ratio.xlsx');
  };

  const faculties = report?.filterOptions.faculties ?? ['All Faculties'];
  const programmes = report?.filterOptions.programmes ?? ['All Programmes'];

  const colSpan = 5;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h5>
          <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
            school
          </span>
          Percentage of staff to student ratio
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
            style={{ width: '200px' }}
            value={programmeFilter}
            onChange={(e) => handleProgrammeChange(e.target.value)}
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
            style={{ width: '200px' }}
            value={courseUnitFilter}
            onChange={(e) => setCourseUnitFilter(e.target.value)}
            aria-label="Course unit"
          >
            {courseUnitOptions.map((cu) => (
              <option key={cu} value={cu}>
                {cu}
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
            <span className="text-muted">Faculty:</span> <strong>{report.facultyName}</strong>
          </span>
          <span>
            <span className="text-muted">Department/Unit:</span> <strong>{report.departmentName}</strong>
          </span>
          <span>
            <span className="text-muted">Programme:</span> <strong>{report.programmeName}</strong>
          </span>
          <span>
            <span className="text-muted">Course unit:</span> <strong>{report.courseUnitName}</strong>
          </span>
          <span>
            <span className="text-muted">Lecturers in report:</span>{' '}
            <strong>{report.numberOfLecturers.toLocaleString()}</strong>
          </span>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 staff-student-ratio-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '220px' }}>
                Name of the Lecturer
              </th>
              <th className="text-center" style={{ minWidth: '90px' }}>
                Gender
              </th>
              <th className="text-center" style={{ minWidth: '180px' }}>
                PWD details
              </th>
              <th className="text-center" style={{ minWidth: '140px' }}>
                Qualification
              </th>
              <th className="text-center" style={{ minWidth: '260px' }}>
                Qualification details
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
                  No data available.
                </td>
              </tr>
            ) : (
              report.rows.map((r, idx) => (
                <tr key={`${r.lecturerName}-${idx}`}>
                  <td className="text-start ps-4 fw-semibold" style={{ fontSize: '.85rem' }}>
                    {r.lecturerName}
                  </td>
                  <td className="text-center" style={{ fontSize: '.85rem' }}>
                    {r.gender ?? '—'}
                  </td>
                  <td className="text-center" style={{ fontSize: '.85rem' }}>
                    {r.pwdDetails ?? '—'}
                  </td>
                  <td className="text-center" style={{ fontSize: '.85rem' }}>
                    {r.qualification ?? '—'}
                  </td>
                  <td className="text-center" style={{ fontSize: '.85rem' }}>
                    {r.qualificationDetails ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

