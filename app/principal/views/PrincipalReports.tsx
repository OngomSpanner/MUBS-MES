'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

type ReportType = 'executive' | 'department' | 'staff' | 'risk';
type ApiReportType = 'activity-summary' | 'staff-evaluation' | 'delayed-activities';
type ExportFormat = 'PDF' | 'Excel';

interface ReportHistoryItem {
    id: string;
    reportType: ReportType;
    title: string;
    subtitle: string;
    generatedAt: string;
    format: ExportFormat;
    params: { from?: string; to?: string; department?: string };
}

interface ShareContext {
    reportType: ReportType;
    title: string;
    subtitle: string;
    params: { from?: string; to?: string; department?: string };
}

const REPORT_TITLES: Record<ReportType, string> = {
    executive: 'Executive Summary',
    department: 'Department Performance Report',
    staff: 'Staff Evaluation Report',
    risk: 'Risk & Delayed Activities',
};

const REPORT_API_TYPE: Record<ReportType, ApiReportType> = {
    executive: 'activity-summary',
    department: 'activity-summary',
    staff: 'staff-evaluation',
    risk: 'delayed-activities',
};

const getScore = (progress: number) =>
    progress >= 80 ? 'Excellent' : progress >= 65 ? 'Good' : progress >= 50 ? 'Fair' : 'Poor';

const getEvaluation = (rate: number) =>
    rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : rate >= 40 ? 'Fair' : 'Poor';

function useReportFetch() {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = useCallback(async (
        type: ApiReportType,
        params: { from?: string; to?: string; department?: string } = {}
    ) => {
        const key = `${type}-${JSON.stringify(params)}`;
        setLoading(key);
        setError(null);
        try {
            const searchParams = new URLSearchParams();
            searchParams.set('type', type);
            if (params.from) searchParams.set('from', params.from);
            if (params.to) searchParams.set('to', params.to);
            if (params.department && params.department !== 'All Departments') searchParams.set('department', params.department);
            const { data } = await axios.get(`/api/reports?${searchParams.toString()}`);
            return data;
        } catch (e: any) {
            const msg = e?.response?.data?.message || 'Failed to load report';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(null);
        }
    }, []);

    return { fetchReport, loading, error };
}

export default function PrincipalReports() {
    const [departments, setDepartments] = useState<string[]>([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All Departments');
    const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
    const [quickPeriod, setQuickPeriod] = useState('Q1 2025');
    const [quickReportType, setQuickReportType] = useState<ReportType>('executive');
    const [quickFormat, setQuickFormat] = useState<ExportFormat>('PDF');
    const [generatingQuick, setGeneratingQuick] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    /* Share by email modal */
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareContext, setShareContext] = useState<ShareContext | null>(null);
    const [shareToEmail, setShareToEmail] = useState('');
    const [shareFormat, setShareFormat] = useState<ExportFormat>('PDF');
    const [shareSending, setShareSending] = useState(false);

    const { fetchReport, loading } = useReportFetch();

    useEffect(() => {
        axios.get('/api/departments')
            .then(({ data }) => setDepartments((Array.isArray(data) ? data : []).map((d: any) => d.name)))
            .catch(() => setDepartments([]));
    }, []);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const getPeriodDates = useCallback((period: string): { from?: string; to?: string } => {
        const now = new Date();
        const y = now.getFullYear();
        switch (period) {
            case 'Q1 2025': return { from: '2025-01-01', to: '2025-03-31' };
            case 'Q2 2025': return { from: '2025-04-01', to: '2025-06-30' };
            case 'Q3 2025': return { from: '2025-07-01', to: '2025-09-30' };
            case 'Q4 2025': return { from: '2025-10-01', to: '2025-12-31' };
            case 'Annual 2024': return { from: '2024-01-01', to: '2024-12-31' };
            default: return {};
        }
    }, []);

    const addToHistory = useCallback((
        reportType: ReportType,
        title: string,
        subtitle: string,
        format: ExportFormat,
        params: { from?: string; to?: string; department?: string }
    ) => {
        setReportHistory(prev => [{
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            reportType,
            title,
            subtitle,
            generatedAt: new Date().toISOString(),
            format,
            params,
        }, ...prev]);
    }, []);

    const exportExcel = useCallback(async (
        reportType: ReportType,
        params: { from?: string; to?: string; department?: string },
        title: string,
        subtitle: string,
        skipHistory?: boolean
    ) => {
        const apiType = REPORT_API_TYPE[reportType];
        try {
            const res = await fetchReport(apiType, params);
            const raw = (res.data || []) as any[];

            if (reportType === 'executive' || reportType === 'department') {
                const rows = raw.map((r: any) => ({
                    Department: r.department,
                    'Total Activities': Number(r.total_activities ?? 0),
                    Completed: Number(r.completed ?? 0),
                    'In Progress': Number(r.in_progress ?? 0),
                    Delayed: Number(r.delayed_cnt ?? 0),
                    'Avg Progress (%)': Number(r.avg_progress ?? 0),
                    Score: getScore(Number(r.avg_progress ?? 0)),
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Report');
                XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
            } else if (reportType === 'staff') {
                const rows = raw.map((r: any) => ({
                    'Staff Name': r.name,
                    Department: r.department ?? '—',
                    Assigned: Number(r.assigned ?? 0),
                    Completed: Number(r.completed ?? 0),
                    'Completion Rate (%)': Number(r.rate ?? 0),
                    Evaluation: getEvaluation(Number(r.rate ?? 0)),
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Report');
                XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
            } else {
                const rows = raw.map((r: any) => ({
                    Title: r.title,
                    Department: r.department,
                    Deadline: r.deadline,
                    'Days Overdue': r.days_overdue,
                    'Progress (%)': r.progress,
                    Status: r.status,
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Report');
                XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
            }
            if (!skipHistory) addToHistory(reportType, title, subtitle, 'Excel', params);
            showToast('Report downloaded.');
        } catch {
            showToast('Failed to generate report.', 'error');
        }
    }, [fetchReport, addToHistory, showToast]);

    const exportPDF = useCallback(async (
        reportType: ReportType,
        params: { from?: string; to?: string; department?: string },
        title: string,
        subtitle: string,
        skipHistory?: boolean
    ) => {
        const apiType = REPORT_API_TYPE[reportType];
        try {
            const res = await fetchReport(apiType, params);
            const raw = (res.data || []) as any[];

            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.setFontSize(14);
            doc.text(title, 14, 15);
            doc.setFontSize(9);
            doc.text(subtitle || `Generated: ${new Date().toLocaleString()}`, 14, 22);

            if (reportType === 'executive' || reportType === 'department') {
                const body = raw.map((r: any) => [
                    r.department,
                    Number(r.total_activities ?? 0),
                    Number(r.completed ?? 0),
                    Number(r.in_progress ?? 0),
                    Number(r.delayed_cnt ?? 0),
                    `${Number(r.avg_progress ?? 0)}%`,
                    getScore(Number(r.avg_progress ?? 0)),
                ]);
                autoTable(doc, {
                    startY: 28,
                    head: [['Department', 'Total', 'Completed', 'In Progress', 'Delayed', 'Avg Progress', 'Score']],
                    body,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [30, 92, 164] },
                });
            } else if (reportType === 'staff') {
                const body = raw.map((r: any) => [
                    r.name,
                    r.department ?? '—',
                    Number(r.assigned ?? 0),
                    Number(r.completed ?? 0),
                    `${Number(r.rate ?? 0)}%`,
                    getEvaluation(Number(r.rate ?? 0)),
                ]);
                autoTable(doc, {
                    startY: 28,
                    head: [['Staff Name', 'Department', 'Assigned', 'Completed', 'Rate', 'Evaluation']],
                    body,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [30, 92, 164] },
                });
            } else {
                const body = raw.map((r: any) => [
                    (r.title || '').slice(0, 40),
                    r.department,
                    r.deadline,
                    r.days_overdue,
                    `${r.progress ?? 0}%`,
                    r.status,
                ]);
                autoTable(doc, {
                    startY: 28,
                    head: [['Title', 'Department', 'Deadline', 'Days Overdue', 'Progress', 'Status']],
                    body,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [30, 92, 164] },
                });
            }
            doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
            if (!skipHistory) addToHistory(reportType, title, subtitle, 'PDF', params);
            showToast('Report downloaded.');
        } catch {
            showToast('Failed to generate report.', 'error');
        }
    }, [fetchReport, addToHistory, showToast]);

    const params = { from: dateFrom || undefined, to: dateTo || undefined, department: departmentFilter };
    const isCardLoading = (key: ReportType) => loading !== null && loading.startsWith(REPORT_API_TYPE[key]);

    const handleCardExport = (reportType: ReportType, format: ExportFormat) => {
        const title = REPORT_TITLES[reportType];
        const subtitle = departmentFilter !== 'All Departments' ? departmentFilter : (dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All departments');
        if (format === 'PDF') {
            exportPDF(reportType, params, title, subtitle);
        } else {
            exportExcel(reportType, params, title, subtitle);
        }
    };

    const openShareModal = (reportType: ReportType) => {
        const title = REPORT_TITLES[reportType];
        const subtitle = departmentFilter !== 'All Departments' ? departmentFilter : (dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All departments');
        setShareContext({ reportType, title, subtitle, params });
        setShareToEmail('');
        setShareFormat('PDF');
        setShareModalOpen(true);
    };

    const openShareModalFromItem = (item: ReportHistoryItem) => {
        setShareContext({ reportType: item.reportType, title: item.title, subtitle: item.subtitle, params: item.params });
        setShareToEmail('');
        setShareFormat('PDF');
        setShareModalOpen(true);
    };

    const generateReportBase64 = useCallback(async (
        reportType: ReportType,
        params: { from?: string; to?: string; department?: string },
        title: string,
        subtitle: string,
        format: ExportFormat
    ): Promise<{ fileBase64: string; fileName: string }> => {
        const apiType = REPORT_API_TYPE[reportType];
        const res = await fetchReport(apiType, params);
        const raw = (res.data || []) as any[];
        const safeName = title.replace(/\s+/g, '_');

        if (format === 'Excel') {
            let rows: any[];
            if (reportType === 'executive' || reportType === 'department') {
                rows = raw.map((r: any) => ({
                    Department: r.department,
                    'Total Activities': Number(r.total_activities ?? 0),
                    Completed: Number(r.completed ?? 0),
                    'In Progress': Number(r.in_progress ?? 0),
                    Delayed: Number(r.delayed_cnt ?? 0),
                    'Avg Progress (%)': Number(r.avg_progress ?? 0),
                    Score: getScore(Number(r.avg_progress ?? 0)),
                }));
            } else if (reportType === 'staff') {
                rows = raw.map((r: any) => ({
                    'Staff Name': r.name,
                    Department: r.department ?? '—',
                    Assigned: Number(r.assigned ?? 0),
                    Completed: Number(r.completed ?? 0),
                    'Completion Rate (%)': Number(r.rate ?? 0),
                    Evaluation: getEvaluation(Number(r.rate ?? 0)),
                }));
            } else {
                rows = raw.map((r: any) => ({
                    Title: r.title,
                    Department: r.department,
                    Deadline: r.deadline,
                    'Days Overdue': r.days_overdue,
                    'Progress (%)': r.progress,
                    Status: r.status,
                }));
            }
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');
            const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            return { fileBase64: base64, fileName: `${safeName}.xlsx` };
        }

        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text(title, 14, 15);
        doc.setFontSize(9);
        doc.text(subtitle || `Generated: ${new Date().toLocaleString()}`, 14, 22);

        if (reportType === 'executive' || reportType === 'department') {
            const body = raw.map((r: any) => [
                r.department,
                Number(r.total_activities ?? 0),
                Number(r.completed ?? 0),
                Number(r.in_progress ?? 0),
                Number(r.delayed_cnt ?? 0),
                `${Number(r.avg_progress ?? 0)}%`,
                getScore(Number(r.avg_progress ?? 0)),
            ]);
            autoTable(doc, {
                startY: 28,
                head: [['Department', 'Total', 'Completed', 'In Progress', 'Delayed', 'Avg Progress', 'Score']],
                body,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 92, 164] },
            });
        } else if (reportType === 'staff') {
            const body = raw.map((r: any) => [
                r.name,
                r.department ?? '—',
                Number(r.assigned ?? 0),
                Number(r.completed ?? 0),
                `${Number(r.rate ?? 0)}%`,
                getEvaluation(Number(r.rate ?? 0)),
            ]);
            autoTable(doc, {
                startY: 28,
                head: [['Staff Name', 'Department', 'Assigned', 'Completed', 'Rate', 'Evaluation']],
                body,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 92, 164] },
            });
        } else {
            const body = raw.map((r: any) => [
                (r.title || '').slice(0, 40),
                r.department,
                r.deadline,
                r.days_overdue,
                `${r.progress ?? 0}%`,
                r.status,
            ]);
            autoTable(doc, {
                startY: 28,
                head: [['Title', 'Department', 'Deadline', 'Days Overdue', 'Progress', 'Status']],
                body,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 92, 164] },
            });
        }
        const dataUri = doc.output('datauristring');
        const fileBase64 = dataUri.split(',')[1] || '';
        return { fileBase64, fileName: `${safeName}.pdf` };
    }, [fetchReport]);

    const handleSendEmail = useCallback(async () => {
        if (!shareContext || !shareToEmail.trim()) {
            showToast('Please enter recipient email address.', 'error');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(shareToEmail.trim())) {
            showToast('Please enter a valid email address.', 'error');
            return;
        }
        setShareSending(true);
        try {
            const { fileBase64, fileName } = await generateReportBase64(
                shareContext.reportType,
                shareContext.params,
                shareContext.title,
                shareContext.subtitle,
                shareFormat
            );
            await axios.post('/api/reports/email', {
                to: shareToEmail.trim(),
                subject: `Report: ${shareContext.title}`,
                reportTitle: shareContext.title,
                format: shareFormat,
                fileBase64,
                fileName,
            });
            showToast('Report sent by email successfully.');
            setShareModalOpen(false);
            setShareContext(null);
        } catch (e: any) {
            const msg = e?.response?.data?.message || 'Failed to send email.';
            showToast(msg, 'error');
        } finally {
            setShareSending(false);
        }
    }, [shareContext, shareToEmail, shareFormat, generateReportBase64, showToast]);

    const handleQuickGenerate = async () => {
        setGeneratingQuick(true);
        const { from, to } = getPeriodDates(quickPeriod);
        const p = { from, to, department: departmentFilter };
        const title = `${REPORT_TITLES[quickReportType]} — ${quickPeriod}`;
        const subtitle = departmentFilter !== 'All Departments' ? departmentFilter : (from && to ? `${from} – ${to}` : 'All data');
        try {
            if (quickFormat === 'PDF') {
                await exportPDF(quickReportType, p, title, subtitle);
            } else {
                await exportExcel(quickReportType, p, title, subtitle);
            }
        } finally {
            setGeneratingQuick(false);
        }
    };

    const handleRedownload = async (item: ReportHistoryItem) => {
        const title = item.title;
        const subtitle = item.subtitle;
        try {
            if (item.format === 'PDF') {
                await exportPDF(item.reportType, item.params, title, subtitle, true);
            } else {
                await exportExcel(item.reportType, item.params, title, subtitle, true);
            }
        } catch {
            showToast('Failed to re-download report.', 'error');
        }
    };

    const formatGeneratedAt = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div id="page-reports" className="page-section active-page">
            {/* Optional filters */}
            <div className="table-card mb-4 p-3">
                <div className="row g-3 align-items-end">
                    <div className="col-md-2">
                        <label className="form-label small fw-bold mb-1">From</label>
                        <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label small fw-bold mb-1">To</label>
                        <input type="date" className="form-control form-control-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-bold mb-1">Department</label>
                        <select className="form-select form-select-sm" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                            <option>All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Report type cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-blue)' }}>
                        <div className="report-card-icon" style={{ background: '#eff6ff' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '26px' }}>summarize</span>
                        </div>
                        <h6>Executive Summary</h6>
                        <p>Full institutional progress overview with KPIs, compliance rates, and risk highlights.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-primary fw-bold flex-fill" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={!!loading} onClick={() => handleCardExport('executive', 'PDF')}>
                                {isCardLoading('executive') ? <span className="spinner-border spinner-border-sm" /> : <><span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF</>}
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('executive', 'Excel')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => openShareModal('executive')}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: '#10b981' }}>
                        <div className="report-card-icon" style={{ background: '#ecfdf5' }}>
                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '26px' }}>corporate_fare</span>
                        </div>
                        <h6>Department Performance Report</h6>
                        <p>Per-department activity completion rates, compliance scores, and comparative analysis across departments.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-success fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('department', 'PDF')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('department', 'Excel')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => openShareModal('department')}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>

                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-yellow)' }}>
                        <div className="report-card-icon" style={{ background: '#fffbeb' }}>
                            <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: '26px' }}>person_search</span>
                        </div>
                        <h6>Staff Evaluation Report</h6>
                        <p>Individual and departmental evaluation scores, completion rates, and performance trends.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm fw-bold flex-fill text-dark" style={{ background: 'var(--mubs-yellow)', borderColor: 'var(--mubs-yellow)' }} disabled={!!loading} onClick={() => handleCardExport('staff', 'PDF')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('staff', 'Excel')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => openShareModal('staff')}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>

                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-red)' }}>
                        <div className="report-card-icon" style={{ background: '#fff1f2' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '26px' }}>crisis_alert</span>
                        </div>
                        <h6>Risk &amp; Delayed Activities</h6>
                        <p>Comprehensive view of all overdue activities, escalation logs, and risk mitigation status.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-danger fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('risk', 'PDF')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-danger fw-bold flex-fill" disabled={!!loading} onClick={() => handleCardExport('risk', 'Excel')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => openShareModal('risk')}>
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent reports generated */}
            <div className="row g-4">
                <div className="col-12 col-lg-7">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>history</span>Recently Generated Reports</h5>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReportHistory([])}>Clear History</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead><tr><th>Report</th><th>Generated</th><th>Format</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {reportHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-4 text-muted">No reports generated yet. Use the cards above or Quick Generate.</td>
                                        </tr>
                                    ) : reportHistory.map(item => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{item.title}</div>
                                                <div className="text-muted" style={{ fontSize: '.72rem' }}>{item.subtitle}</div>
                                            </td>
                                            <td style={{ fontSize: '.83rem' }}>{formatGeneratedAt(item.generatedAt)}</td>
                                            <td><span className={`badge ${item.format === 'PDF' ? 'bg-danger' : 'bg-success'}`}>{item.format}</span></td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    <button type="button" className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: '.75rem' }} title="Download" onClick={() => handleRedownload(item)}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
                                                    </button>
                                                    <button type="button" className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.75rem' }} title="Share" onClick={() => openShareModalFromItem(item)}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer">
                            <span className="footer-label">{reportHistory.length} report{reportHistory.length !== 1 ? 's' : ''} in history</span>
                            {reportHistory.length > 0 && (
                                <button type="button" className="btn btn-sm btn-primary fw-bold" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} onClick={() => handleRedownload(reportHistory[0])}>
                                    <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>Download Latest
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-5 d-flex flex-column gap-4">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>schedule_send</span>Scheduled Reports</h5>
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => showToast('Scheduling coming soon.')}>+ Schedule</button>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Monthly Executive Summary</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>Every 1st of month · PDF · Email</div>
                                </div>
                                <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.62rem' }}>Active</span>
                            </div>
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Quarterly Risk Report</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>End of each quarter · PDF</div>
                                </div>
                                <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.62rem' }}>Active</span>
                            </div>
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Annual Staff Evaluation</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>Dec 31 · Excel · Board Package</div>
                                </div>
                                <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207', fontSize: '.62rem' }}>Upcoming</span>
                            </div>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>bolt</span>Quick Generate</h5>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <div className="row g-2">
                                <div className="col-6">
                                    <select className="form-select form-select-sm" value={quickPeriod} onChange={e => setQuickPeriod(e.target.value)}>
                                        <option>Q1 2025</option>
                                        <option>Q2 2025</option>
                                        <option>Q3 2025</option>
                                        <option>Q4 2025</option>
                                        <option>Annual 2024</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <select className="form-select form-select-sm" value={quickReportType} onChange={e => setQuickReportType(e.target.value as ReportType)}>
                                        <option value="executive">Executive Summary</option>
                                        <option value="department">Department Performance</option>
                                        <option value="staff">Staff Evaluation</option>
                                        <option value="risk">Risk Report</option>
                                    </select>
                                </div>
                            </div>
                            <div className="row g-2">
                                <div className="col-6">
                                    <select className="form-select form-select-sm" value={quickFormat} onChange={e => setQuickFormat(e.target.value as ExportFormat)}>
                                        <option>PDF</option>
                                        <option>Excel</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <button type="button" className="btn btn-sm w-100 fw-bold text-white" style={{ background: 'var(--mubs-blue)' }} disabled={generatingQuick} onClick={handleQuickGenerate}>
                                        {generatingQuick ? <span className="spinner-border spinner-border-sm" /> : <><span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>auto_awesome</span>Generate</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Share by email modal */}
            {shareModalOpen && shareContext && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>mail</span>
                                    Email report
                                </h5>
                                <button type="button" className="btn-close" onClick={() => { setShareModalOpen(false); setShareContext(null); }} aria-label="Close" />
                            </div>
                            <div className="modal-body">
                                <p className="text-muted small mb-3">Send this report as an attachment (PDF or Excel) to the recipient.</p>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small">Report</label>
                                    <div className="form-control form-control-sm bg-light" style={{ fontSize: '.9rem' }}>
                                        {shareContext?.title}
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small">Recipient email</label>
                                    <input
                                        type="email"
                                        className="form-control form-control-sm"
                                        placeholder="e.g. recipient@example.com"
                                        value={shareToEmail}
                                        onChange={e => setShareToEmail(e.target.value)}
                                    />
                                </div>
                                <div className="mb-0">
                                    <label className="form-label fw-bold small">Format</label>
                                    <select className="form-select form-select-sm" value={shareFormat} onChange={e => setShareFormat(e.target.value as ExportFormat)}>
                                        <option value="PDF">PDF</option>
                                        <option value="Excel">Excel</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => { setShareModalOpen(false); setShareContext(null); }}>Cancel</button>
                                <button type="button" className="btn btn-primary fw-bold" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={shareSending} onClick={handleSendEmail}>
                                    {shareSending ? <><span className="spinner-border spinner-border-sm me-1" />Sending…</> : <><span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>send</span>Send email</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                    <div className={`toast show align-items-center text-white border-0 ${toast.type === 'error' ? 'bg-danger' : 'bg-primary'}`} role="alert">
                        <div className="d-flex">
                            <div className="toast-body">{toast.message}</div>
                            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} aria-label="Close" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
