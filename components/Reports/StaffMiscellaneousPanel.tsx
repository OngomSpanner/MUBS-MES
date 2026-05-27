'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffMiscellaneousReport } from '@/lib/hrms/staff-miscellaneous';

export default function StaffMiscellaneousPanel() {
  const [report, setReport] = useState<StaffMiscellaneousReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/reports?type=staff-miscellaneous');
      setReport(data.data as StaffMiscellaneousReport);
    } catch (e) {
      console.error('staff-miscellaneous error', e);
      setError('Could not load miscellaneous report data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCount = (n: number) => (n > 0 ? String(n) : '—');
  const yearKeys = report?.yearKeys ?? [];
  const colSpan = 1 + yearKeys.length;

  const buildExportRows = (r: StaffMiscellaneousReport) =>
    r.rows.map((row) => [
      row.metricLabel,
      ...r.yearKeys.map((key) => formatCount(row.countsByYear[key] ?? 0)),
    ]);

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    autoTable(doc, {
      startY: 15,
      head: [['', ...report.yearKeys.map((key) => report.years[key] ?? key)]],
      body: buildExportRows(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Staff_Miscellaneous.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['', ...report.yearKeys.map((key) => report.years[key] ?? key)],
      ...buildExportRows(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Miscellaneous');
    XLSX.writeFile(wb, 'Staff_Miscellaneous.xlsx');
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
        <table className="table mb-0 staff-miscellaneous-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '320px' }} aria-hidden="true" />
              {yearKeys.map((key, i) => (
                <th
                  key={key}
                  className={`text-center ${i > 0 ? 'establishment-year-divider' : ''}`}
                  style={{ color: 'var(--mubs-blue)', fontWeight: 800, minWidth: '100px' }}
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
              report.rows.map((row) => (
                <tr key={row.metricType}>
                  <td className="fw-bold text-dark ps-4" style={{ fontSize: '.85rem' }}>
                    {row.metricLabel}
                  </td>
                  {report.yearKeys.map((key, i) => (
                    <td
                      key={key}
                      className={`text-center ${i > 0 ? 'establishment-year-divider' : ''}`}
                      style={{ fontSize: '.85rem' }}
                    >
                      {formatCount(row.countsByYear[key] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
