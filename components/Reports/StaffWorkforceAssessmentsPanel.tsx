'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import type { StaffWorkforceAssessmentsReport } from '@/lib/hrms/staff-workforce-assessments';

export default function StaffWorkforceAssessmentsPanel({
  ambassadorManagedUnitId,
  embedded = false,
}: {
  ambassadorManagedUnitId?: number;
  embedded?: boolean;
} = {}) {
  const [report, setReport] = useState<StaffWorkforceAssessmentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'staff-workforce-assessments' });
      if (ambassadorManagedUnitId) params.set('managed_unit_id', String(ambassadorManagedUnitId));
      const { data } = await axios.get(`/api/reports?${params.toString()}`);
      setReport(data.data as StaffWorkforceAssessmentsReport);
    } catch (e) {
      console.error('staff-workforce-assessments error', e);
      setError('Could not load workforce assessments data.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [ambassadorManagedUnitId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCount = (n: number) => (n > 0 ? String(n) : '—');
  const yearKeys = report?.yearKeys ?? [];
  const colSpan = 1 + yearKeys.length;

  const buildExportRows = (r: StaffWorkforceAssessmentsReport) =>
    r.rows.map((row) => [
      row.assessmentDetail,
      ...r.yearKeys.map((key) => formatCount(row.countsByYear[key] ?? 0)),
    ]);

  const exportPDF = async () => {
    if (!report) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    autoTable(doc, {
      startY: 15,
      head: [['Assessment details', ...report.yearKeys.map((key) => report.years[key] ?? key)]],
      body: buildExportRows(report),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
    });

    doc.save('Workforce_Assessments.pdf');
  };

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Assessment details', ...report.yearKeys.map((key) => report.years[key] ?? key)],
      ...buildExportRows(report),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workforce Assessments');
    XLSX.writeFile(wb, 'Workforce_Assessments.xlsx');
  };

  return (
    <div className={embedded ? 'border-0 shadow-none bg-transparent' : 'table-card'}>
      <div className={embedded ? 'px-3 pt-3 pb-2 border-bottom d-flex justify-content-end' : 'table-card-header justify-content-end'}>
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
        <table className="table mb-0 staff-workforce-assessments-table">
          <thead>
            <tr>
              <th className="text-start ps-4" style={{ minWidth: '280px' }}>
                Assessment details
              </th>
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
            ) : !report || report.rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-4 text-muted">
                  No workforce assessments recorded. Add entries in M&amp;E (assessment detail and count per year).
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.assessmentDetail}>
                  <td className="fw-bold text-dark ps-4" style={{ fontSize: '.85rem' }}>
                    {row.assessmentDetail}
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
