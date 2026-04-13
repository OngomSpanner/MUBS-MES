'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import StatCard from '@/components/StatCard';
import EvaluationCardGrid from '@/components/Department/EvaluationCardGrid';
import EvaluateSubmissionModal, { type FeedbackHistoryEntry } from '@/components/Department/EvaluateSubmissionModal';

interface Evaluation {
    id: number;
    report_name: string;
    activity_title: string;
    staff_name: string;
    submitted_at: string;
    status: string;
    progress: number;
    report_summary: string;
    attachments?: string | null;
    score?: number;
    reviewer_notes?: string;
    task_type?: 'process' | 'kpi_driver';
    kpi_actual_value?: number | null;
}

interface EvaluationData {
    pending: Evaluation[];
    completed: Evaluation[];
}

export default function DepartmentEvaluations() {
    const [data, setData] = useState<EvaluationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Draft states for evaluations (performance: Complete=2, Incomplete=1, Not Done=0)
    const [selectedRating, setSelectedRating] = useState<{ [key: number]: 'Complete' | 'Incomplete' | 'Not Done' }>({});
    const [comments, setComments] = useState<{ [key: number]: string }>({});
    const [kpiActualValues, setKpiActualValues] = useState<{ [key: number]: string }>({});
    // Modal view states
    const [evaluateModalItem, setEvaluateModalItem] = useState<Evaluation | null>(null);
    const [viewModalItem, setViewModalItem] = useState<Evaluation | null>(null);

    // Table filter & pagination
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);
    const [feedbackHistoryForReview, setFeedbackHistoryForReview] = useState<FeedbackHistoryEntry[]>([]);
    const [evalError, setEvalError] = useState<string | null>(null);
    const [evalSuccess, setEvalSuccess] = useState<string | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);
    
    useEffect(() => {
        if (evaluateModalItem) {
            const id = evaluateModalItem.id;
            // Pre-populate KPI value from what staff entered if not already set locally
            if (evaluateModalItem.kpi_actual_value != null && kpiActualValues[id] === undefined) {
                setKpiActualValues(prev => ({ ...prev, [id]: String(evaluateModalItem.kpi_actual_value) }));
            }
        }
    }, [evaluateModalItem]);

    useEffect(() => {
        if (!evaluateModalItem) {
            setFeedbackHistoryForReview([]);
            return;
        }
        let cancelled = false;
        axios
            .get(`/api/department-head/staff-reports/${evaluateModalItem.id}/feedback-events`)
            .then((res) => {
                if (!cancelled) setFeedbackHistoryForReview(res.data?.events || []);
            })
            .catch(() => {
                if (!cancelled) setFeedbackHistoryForReview([]);
            });
        return () => {
            cancelled = true;
        };
    }, [evaluateModalItem]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/department-head/evaluations');
            setData(response.data);
        } catch (error: any) {
            console.error('Error fetching department evaluations:', error);
            setError(error.response?.data?.message || 'Failed to load submissions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error loading submissions</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const handleComment = (id: number, comment: string) => {
        setComments(prev => ({ ...prev, [id]: comment }));
    };

    const handleSubmitEvaluation = async () => {
        setEvalError(null);
        setEvalSuccess(null);
        if (!evaluateModalItem) return;
        const id = evaluateModalItem.id;
        const status = selectedRating[id];
        const comment = comments[id];
        const item = data?.pending.find(p => p.id === id) ?? data?.completed.find(c => c.id === id);
        const isKpiDriver = item?.task_type === 'kpi_driver';
        const kpiActual = kpiActualValues[id];

        if (!status) {
            setEvalError('Please select a rating: Complete, Incomplete (revision), or Not Done (0 pts).');
            return;
        }
        if (status === 'Incomplete' && (!comment || String(comment).trim() === '')) {
            setEvalError('Comment is required when marking Incomplete.');
            return;
        }

        const score = status === 'Complete' ? 2 : status === 'Incomplete' ? 1 : 0;
        setIsSubmittingEvaluation(true);
        try {
            const res = await axios.put('/api/department-head/evaluations', {
                id,
                status,
                score,
                reviewer_notes: comment || '',
                kpi_actual_value: status === 'Complete' && isKpiDriver && kpiActual != null && String(kpiActual).trim() !== '' ? Number(kpiActual) : undefined
            });
            const updated = res.data?.updated;
            if (updated && status === 'Complete' && (updated.taskId || updated.parentId)) {
                console.log('Evaluation saved. Task/parent updated in DB:', updated);
            }

            if (status === 'Complete') {
                const isProcess = item?.task_type !== 'kpi_driver';
                const delayed = res.data?.delayedHodNoteApplied as boolean | undefined;
                if (isProcess) {
                    setEvalSuccess('Review saved. Completion approved; full credit recorded for this process task.');
                } else if (delayed) {
                    setEvalSuccess('Review saved. Feedback may include a system note about review timing.');
                } else {
                    setEvalSuccess('Review saved successfully.');
                }
            } else {
                setEvalSuccess('Review saved successfully.');
            }

            await fetchData();
            setTimeout(() => {
                setEvaluateModalItem(null);
                setEvalSuccess(null);
            }, 1200);
            setSelectedRating(prev => { const next = { ...prev }; delete next[id]; return next; });
            setComments(prev => { const next = { ...prev }; delete next[id]; return next; });
            setKpiActualValues(prev => { const next = { ...prev }; delete next[id]; return next; });
        } catch (error: any) {
            console.error('Error submitting evaluation:', error);
            const msg = error.response?.data?.message || error.response?.data?.detail || 'Failed to save review.';
            setEvalError(msg);
        } finally {
            setIsSubmittingEvaluation(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    };

    /** Rating used to evaluate: Complete, Incomplete, or Not Done. Shown in table and Evaluation Record modal. */
    const getRatingLabel = (e: { score?: number | null; status: string }, isPending = false): string => {
        if (isPending || e.status === 'Pending') return '—';
        if (e.score != null && e.score <= 2) {
            if (e.score === 2) return 'Complete';
            if (e.score === 1) {
                if (e.status === 'Completed') return 'Complete (1 pt)';
                return 'Incomplete';
            }
            if (e.score === 0 && e.status === 'Completed') return 'Complete (0 pt)';
            return 'Not Done';
        }
        if (e.status === 'Completed') return 'Complete';
        if (e.status === 'Not Done') return 'Not Done';
        if (e.status === 'Incomplete' || e.status === 'Returned') return 'Incomplete';
        return '—';
    };

    const handleExportExcel = () => {
        if (!data || data.completed.length === 0) {
            setPageError("No completed evaluations to export.");
            setTimeout(() => setPageError(null), 3000);
            return;
        }

        const exportData = data.completed.map(e => ({
            "Staff Name": e.staff_name,
            "Activity Title": e.activity_title,
            "Report Name": e.report_name,
            "Date Evaluated": formatDate(e.submitted_at),
            "Status": e.status === 'Completed' ? 'Accepted' : 'Returned',
            "Progress": `${e.progress}%`,
            "Rating": getRatingLabel(e)
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluations");
        XLSX.writeFile(workbook, `Evaluations_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!data || data.completed.length === 0) {
            setPageError("No completed evaluations to export.");
            setTimeout(() => setPageError(null), 3000);
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("Evaluations Export", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

        const tableColumn = ["Staff Name", "Activity Title", "Report Name", "Date Evaluated", "Status", "Rating"];
        const tableRows = data.completed.map(e => [
            e.staff_name,
            e.activity_title,
            e.report_name,
            formatDate(e.submitted_at),
            e.status === 'Completed' ? 'Accepted' : 'Returned',
            getRatingLabel(e)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`Evaluations_Export_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div id="page-evaluations" className="page-section active-page position-relative">
            {pageError && (
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-3 mb-4 animate__animated animate__fadeInDown" role="alert" style={{ borderRadius: '12px', background: '#fef2f2', border: '1px solid #fee2e2' }}>
                    <span className="material-symbols-outlined text-danger">error</span>
                    <div className="fw-semibold text-danger">{pageError}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setPageError(null)} style={{ fontSize: '0.75rem' }}></button>
                </div>
            )}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="pending_actions"
                        label="Total Pending"
                        value={data.pending.length}
                        badge="Needs Review"
                        badgeIcon="schedule"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="task_alt"
                        label="Total Completed"
                        value={data.completed.length}
                        badge="Reviewed"
                        badgeIcon="done_all"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="check_circle"
                        label="Accepted"
                        value={data.completed.filter(e => e.status === 'Completed').length}
                        badge="Approved"
                        badgeIcon="thumb_up"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment_return"
                        label="Returned"
                        value={data.completed.filter(e => e.status !== 'Completed').length}
                        badge="Requires Edits"
                        badgeIcon="edit_note"
                        color="red"
                    />
                </div>
            </div>

            {/* Modal Backdrop */}
            {(evaluateModalItem || viewModalItem) && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}></div>
            )}

            {/* View Details Modal for Completed/Returned evaluations */}
            <div className={`modal fade ${viewModalItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>description</span>
                                Review record
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setViewModalItem(null)}></button>
                        </div>
                        {viewModalItem && (
                            <div className="modal-body p-4">
                                {/* Info Banner */}
                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                                        <div className="flex-fill">
                                            <div className="d-flex align-items-center gap-3 mb-2">
                                                <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{viewModalItem.report_name}</div>
                                                <span className="status-badge" style={{
                                                    background: viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                    color: viewModalItem.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                    fontSize: '.75rem',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px'
                                                }}>{viewModalItem.status === 'Completed' ? 'Accepted' : 'Returned'}</span>
                                            </div>
                                            <div className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>category</span>
                                                {viewModalItem.activity_title}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>person</span>
                                                Submitted by <strong>{viewModalItem.staff_name}</strong>
                                            </div>
                                            {viewModalItem.task_type === 'kpi_driver' && (
                                                <div className="mt-2 text-primary fw-black" style={{ fontSize: '0.9rem' }}>
                                                    Achieved KPI : {viewModalItem.kpi_actual_value != null ? viewModalItem.kpi_actual_value : '—'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-md-end mt-3 pt-3 border-top w-100 d-flex align-items-center justify-content-between">
                                            <div className="text-dark fw-bold" style={{ fontSize: '.7rem', letterSpacing: '.05em' }}>PROGRESS</div>
                                            <div className="d-flex align-items-center gap-3 flex-grow-1 mx-4">
                                                <div className="progress flex-grow-1" style={{ height: '8px', borderRadius: '4px' }}>
                                                    <div className="progress-bar bg-primary" style={{ width: `${viewModalItem.progress || 0}%` }}></div>
                                                </div>
                                                <div className="fw-black text-primary" style={{ fontSize: '1.1rem' }}>{viewModalItem.progress || 0}%</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Report Details */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>subject</span>
                                        Report Summary
                                    </label>
                                    <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <p className="mb-0 text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                            {viewModalItem.report_summary || 'No summary provided.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Evaluation Section */}
                                <div className="p-3 rounded-3" style={{ 
                                    background: viewModalItem.status === 'Completed' ? '#f0fdf4' : '#fff1f2', 
                                    border: `1px solid ${viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2'}` 
                                }}>
                                    <div className="row g-3 align-items-center">
                                        <div className="col-4 text-center border-end">
                                            <div className="fw-black text-dark" style={{ fontSize: '1.4rem', lineHeight: '1' }}>{viewModalItem.score ?? '-'}</div>
                                            <div className="text-muted fw-bold mt-2" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>RATING</div>
                                            <div className="fw-bold mt-2" style={{ 
                                                fontSize: '0.8rem',
                                                color: getRatingLabel(viewModalItem).startsWith('Complete') ? '#15803d' : (getRatingLabel(viewModalItem) === 'Not Done' ? '#64748b' : '#b45309')
                                            }}>
                                                {getRatingLabel(viewModalItem)}
                                            </div>
                                        </div>
                                        <div className="col-8 ps-4">
                                            <div className="fw-bold text-dark mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>forum</span>
                                                Feedback
                                            </div>
                                            <p className="mb-0 text-dark italic" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                                                {viewModalItem.reviewer_notes ? `"${viewModalItem.reviewer_notes}"` : 'No comments.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <EvaluateSubmissionModal
                item={evaluateModalItem}
                open={!!evaluateModalItem}
                onClose={() => setEvaluateModalItem(null)}
                formatDate={formatDate}
                selectedRating={selectedRating}
                onSelectRating={(id, rating) => setSelectedRating((prev) => ({ ...prev, [id]: rating }))}
                comments={comments}
                onCommentChange={handleComment}
                kpiActualValues={kpiActualValues}
                onKpiActualChange={(id, value) => setKpiActualValues((prev) => ({ ...prev, [id]: value }))}
                onSubmit={handleSubmitEvaluation}
                isSubmitting={isSubmittingEvaluation}
                feedbackHistory={feedbackHistoryForReview}
                error={evalError}
                success={evalSuccess}
            />

            {/* Combined Evaluations Table */}
            {(() => {
                const allEvaluations = [
                    ...data.pending,
                    ...data.completed
                ];

                const filtered = allEvaluations.filter(e => {
                    const matchesSearch = searchTerm === '' ||
                        e.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        e.report_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        e.activity_title.toLowerCase().includes(searchTerm.toLowerCase());

                    const matchesStatus =
                        statusFilter === 'All' ||
                        (statusFilter === 'Pending' && data.pending.some(p => p.id === e.id)) ||
                        (statusFilter === 'Complete' && e.status === 'Completed') ||
                        (statusFilter === 'Incomplete' && (e.status === 'Incomplete' || e.status === 'Returned')) ||
                        (statusFilter === 'Not Done' && e.status === 'Not Done');

                    return matchesSearch && matchesStatus;
                });

                const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
                const safePage = Math.min(currentPage, totalPages);
                const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
                const isPending = (e: Evaluation) => data.pending.some(p => p.id === e.id);

                return (
                    <div className="table-card shadow-sm">
                        <div className="table-card-header">
                            <h5 className="mb-0 d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>grading</span>
                                All submissions
                                <span className="badge rounded-pill ms-1" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '.75rem', fontWeight: 700 }}>
                                    {filtered.length}
                                </span>
                            </h5>
                            <div className="d-flex gap-2 flex-wrap align-items-center">
                                {/* Search */}
                                <div className="input-group input-group-sm" style={{ width: '190px' }}>
                                    <span className="input-group-text bg-white border-end-0">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#64748b' }}>search</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                {/* Status Filter */}
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: '140px' }}
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Complete">Complete</option>
                                    <option value="Incomplete">Incomplete</option>
                                    <option value="Not Done">Not Done</option>
                                </select>
                                {/* Export buttons */}
                                <button className="btn btn-sm btn-outline-success fw-bold d-flex align-items-center gap-1 px-3" onClick={handleExportExcel}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table</span>
                                    Excel
                                </button>
                                <button className="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center gap-1 px-3" onClick={handleExportPDF}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                                    PDF
                                </button>

                                <div className="vr mx-1" style={{ opacity: 0.1 }}></div>

                                <div className="btn-group border rounded-3 p-1 bg-light shadow-sm">
                                    <button 
                                        className={`btn btn-sm d-flex align-items-center gap-1 fw-bold ${viewMode === 'grid' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                                        onClick={() => setViewMode('grid')}
                                        style={{ borderRadius: '6px', fontSize: '0.75rem', transition: 'all 0.2s' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
                                        Grid View
                                    </button>
                                    <button 
                                        className={`btn btn-sm d-flex align-items-center gap-1 fw-bold ${viewMode === 'table' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                                        onClick={() => setViewMode('table')}
                                        style={{ borderRadius: '6px', fontSize: '0.75rem', transition: 'all 0.2s' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table_rows</span>
                                        Table View
                                    </button>
                                </div>
                            </div>
                        </div>

                        {viewMode === 'grid' ? (
                            <div className="p-4" style={{ background: '#f8fafc' }}>
                                <EvaluationCardGrid 
                                    evaluations={paged} 
                                    onEvaluate={setEvaluateModalItem} 
                                    onView={setViewModalItem}
                                    isPending={isPending}
                                />
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table mb-0 align-middle">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="ps-4">Staff Member</th>
                                            <th>Report</th>
                                            <th>Strategic Activity</th>
                                            <th>Date</th>
                                            <th>Progress</th>
                                            <th>Rating</th>
                                            <th>Status</th>
                                            <th className="pe-4 text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-5 text-muted">
                                                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '48px', opacity: 0.25 }}>grading</span>
                                                    <span className="fw-semibold d-block" style={{ fontSize: '.9rem' }}>No evaluations found</span>
                                                    <span style={{ fontSize: '.8rem' }}>Try adjusting your search or filter.</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            paged.map(e => {
                                                const pending = isPending(e);
                                                const avatarBg = pending ? 'var(--mubs-blue)' : (e.status === 'Completed' ? '#10b981' : e.status === 'Not Done' ? '#64748b' : '#f59e0b');
                                                return (
                                                    <tr key={e.id}>
                                                        <td className="ps-4">
                                                            <div className="d-flex align-items-center gap-2 py-1">
                                                                <div className="staff-avatar" style={{
                                                                    background: avatarBg,
                                                                    width: '34px', height: '34px', borderRadius: '10px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: '#fff', fontWeight: 'bold', fontSize: '.75rem', flexShrink: 0
                                                                }}>
                                                                    {getInitials(e.staff_name)}
                                                                </div>
                                                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{e.staff_name}</div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{e.report_name}</div>
                                                            <div className="text-muted" style={{ fontSize: '.72rem' }}>ID: #{e.id}</div>
                                                        </td>
                                                        <td>
                                                            <span className="text-muted" style={{ fontSize: '.8rem' }}>{e.activity_title}</span>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '.8rem' }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{pending ? 'schedule' : 'calendar_today'}</span>
                                                                {formatDate(e.submitted_at)}
                                                            </div>
                                                        </td>
                                                        <td style={{ minWidth: '110px' }}>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="progress w-100" style={{ height: '6px', borderRadius: '10px' }}>
                                                                    <div className="progress-bar" style={{
                                                                        width: `${e.progress || 0}%`,
                                                                        background: pending
                                                                            ? ((e.progress || 0) > 70 ? '#10b981' : ((e.progress || 0) > 30 ? '#f59e0b' : '#3b82f6'))
                                                                            : (e.status === 'Completed' ? '#10b981' : e.status === 'Not Done' ? '#64748b' : '#f59e0b'),
                                                                        borderRadius: '10px'
                                                                    }}></div>
                                                                </div>
                                                                <span className="small fw-bold" style={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{e.progress || 0}%</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="fw-semibold" style={{
                                                                fontSize: '.85rem',
                                                                color: getRatingLabel(e, pending).startsWith('Complete') ? '#15803d' : getRatingLabel(e, pending) === 'Not Done' ? '#64748b' : '#b45309'
                                                            }}>
                                                                {getRatingLabel(e, pending)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {pending ? (
                                                                <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>
                                                                    <span className="material-symbols-outlined me-1" style={{ fontSize: '12px', verticalAlign: 'middle' }}>hourglass_empty</span>
                                                                    Pending
                                                                </span>
                                                            ) : (
                                                                <span className="status-badge" style={{
                                                                    background: e.status === 'Completed' ? '#dcfce7' : e.status === 'Not Done' ? '#f1f5f9' : '#fef3c7',
                                                                    color: e.status === 'Completed' ? '#15803d' : e.status === 'Not Done' ? '#475569' : '#b45309',
                                                                    fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: '600'
                                                                }}>
                                                                    <span className="material-symbols-outlined me-1" style={{ fontSize: '12px', verticalAlign: 'middle' }}>{e.status === 'Completed' ? 'check_circle' : e.status === 'Not Done' ? 'cancel' : 'feedback'}</span>
                                                                    {e.status === 'Completed' ? 'Complete' : e.status === 'Not Done' ? 'Not Done' : (e.status === 'Incomplete' ? 'Incomplete' : 'Returned')}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="pe-4 text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                {pending ? (
                                                                    <button
                                                                        className="btn btn-sm btn-primary fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                                                                        style={{ fontSize: '.75rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                                                        onClick={() => setEvaluateModalItem(e)}
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>rate_review</span>
                                                                        Evaluate
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className="btn btn-sm btn-outline-secondary fw-bold d-inline-flex align-items-center gap-1"
                                                                        style={{ fontSize: '.75rem' }}
                                                                        onClick={() => setViewModalItem(e)}
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>visibility</span>
                                                                        View
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer: pagination + page count */}
                        <div className="table-card-footer d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <span className="text-muted" style={{ fontSize: '.8rem' }}>
                                Showing <strong>{paged.length > 0 ? (safePage - 1) * pageSize + 1 : 0}</strong>–<strong>{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> evaluations
                            </span>
                            <div className="d-flex align-items-center gap-3">
                                {/* Rows per page */}
                                <div className="d-flex align-items-center gap-2">
                                    <span className="text-muted" style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>Rows per page:</span>
                                    <select
                                        className="form-select form-select-sm"
                                        style={{ width: '70px' }}
                                        value={pageSize}
                                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                {/* Page counter */}
                                <span className="text-muted fw-semibold" style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                                    Page {safePage} of {totalPages}
                                </span>
                                {/* Prev / Next */}
                                <div className="d-flex gap-1">
                                    <button
                                        className="btn btn-sm btn-light border d-flex align-items-center px-2"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        style={{ fontSize: '.8rem' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                                    </button>
                                    <button
                                        className="btn btn-sm btn-light border d-flex align-items-center px-2"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        style={{ fontSize: '.8rem' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

