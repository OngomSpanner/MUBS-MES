'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffEmploymentSkillStatusReport } from '@/lib/hrms/staff-employment-skill-status';

export default function StaffEmploymentSkillStatusPanel() {
  const [report, setReport] = useState<StaffEmploymentSkillStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/reports?type=staff-employment-skill-status');
      setReport(data.data as StaffEmploymentSkillStatusReport);
    } catch (e) {
      console.error('staff-employment-skill-status error', e);
      setError('Could not load employment & skill status data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCount = (n: number) => (n > 0 ? String(n) : '—');
  const colSpan = report ? report.byYear.length * 2 : 4;

  const buildExportRow = (r: StaffEmploymentSkillStatusReport) => [
    r.byYear.flatMap((y) => [formatCount(y.reportsProduced), formatCount(y.skillsMissing)]),
  ];

  const exportHeaders = (r: StaffEmploymentSkillStatusReport) =>
    r.byYear.flatMap((y) => [y.yearLabel, 'Skills missing']);

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    autoTable(doc, {
      startY: 15,
      head: [exportHeaders(report)],
      body: buildExportRow(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Employment_Skill_Status.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([exportHeaders(report), ...buildExportRow(report)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employment Skill Status');
    XLSX.writeFile(wb, 'Employment_Skill_Status.xlsx');
  };

  return (
    <div className="table-card">
      <div className="table-card-header justify-content-end">
        <div className="d-flex gap-2 flex-wrap align-items-center">
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
        <table className="table mb-0 staff-employment-skill-table">
          <thead>
            <tr>
              {report?.byYear.flatMap((y, i) => [
                <th
                  key={`${y.yearKey}-year`}
                  className={`text-center ${i > 0 ? 'establishment-year-divider' : ''}`}
                  style={{ color: 'var(--mubs-blue)', fontWeight: 800, minWidth: '90px' }}
                >
                  {y.yearLabel}
                </th>,
                <th key={`${y.yearKey}-skills`} className="text-center" style={{ minWidth: '110px' }}>
                  Skills missing
                </th>,
              ]) ?? (
                <>
                  <th>2024/25</th>
                  <th>Skills missing</th>
                  <th>2025/26</th>
                  <th>Skills missing</th>
                </>
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
            ) : !report ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No data available.
                </td>
              </tr>
            ) : (
              <tr>
                {report.byYear.flatMap((y, i) => [
                  <td
                    key={`${y.yearKey}-reports`}
                    className={`text-center fw-semibold ${i > 0 ? 'establishment-year-divider' : ''}`}
                    style={{ fontSize: '.85rem' }}
                  >
                    {formatCount(y.reportsProduced)}
                  </td>,
                  <td key={`${y.yearKey}-skills-val`} className="text-center" style={{ fontSize: '.85rem' }}>
                    {formatCount(y.skillsMissing)}
                  </td>,
                ])}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
