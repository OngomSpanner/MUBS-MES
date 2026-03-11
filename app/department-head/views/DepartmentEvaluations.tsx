'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Evaluation {
    id: number;
    report_name: string;
    activity_title: string;
    staff_name: string;
    submitted_at: string;
    status: string;
    progress: number;
    report_summary: string;
    score?: number;
    reviewer_notes?: string;
}

interface EvaluationData {
    pending: Evaluation[];
    completed: Evaluation[];
}

export default function DepartmentEvaluations() {
    const [data, setData] = useState<EvaluationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Draft states for evaluations
    const [scores, setScores] = useState<{ [key: number]: number }>({});
    const [comments, setComments] = useState<{ [key: number]: string }>({});

    // Modal view states
    const [evaluateModalItem, setEvaluateModalItem] = useState<Evaluation | null>(null);
    const [viewModalItem, setViewModalItem] = useState<Evaluation | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/department-head/evaluations');
            setData(response.data);
        } catch (error: any) {
            console.error('Error fetching department evaluations:', error);
            setError(error.response?.data?.message || 'Failed to load evaluations. Please try again.');
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
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Evaluations</h5>
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

    const handleScore = (id: number, score: number) => {
        setScores(prev => ({ ...prev, [id]: score }));
    };

    const handleComment = (id: number, comment: string) => {
        setComments(prev => ({ ...prev, [id]: comment }));
    };

    const handleSubmitEvaluation = async (id: number, status: 'Completed' | 'Returned') => {
        const score = scores[id];
        const comment = comments[id];

        if (status === 'Completed' && !score) {
            alert("Please provide a quality score before accepting the evaluation.");
            return;
        }

        try {
            await axios.put('/api/department-head/evaluations', {
                id,
                status,
                score: status === 'Completed' ? (score ?? undefined) : undefined,
                reviewer_notes: comment || ''
            });

            await fetchData();
            setEvaluateModalItem(null); // Close modal on success

            // clear state for this item
            setScores(prev => { const newScores = { ...prev }; delete newScores[id]; return newScores; });
            setComments(prev => { const newComments = { ...prev }; delete newComments[id]; return newComments; });

        } catch (error: any) {
            console.error('Error submitting evaluation:', error);
            const msg = error.response?.data?.message || error.response?.data?.detail || 'Failed to submit evaluation.';
            alert(msg);
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

    const handleExportExcel = () => {
        if (!data || data.completed.length === 0) {
            alert("No completed evaluations to export.");
            return;
        }

        const exportData = data.completed.map(e => ({
            "Staff Name": e.staff_name,
            "Activity Title": e.activity_title,
            "Report Name": e.report_name,
            "Date Evaluated": formatDate(e.submitted_at),
            "Status": e.status === 'Completed' ? 'Accepted' : 'Returned',
            "Progress": `${e.progress}%`,
            "Score": e.score || 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluations");
        XLSX.writeFile(workbook, `Evaluations_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!data || data.completed.length === 0) {
            alert("No completed evaluations to export.");
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("Evaluations Export", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

        const tableColumn = ["Staff Name", "Activity Title", "Report Name", "Date Evaluated", "Status", "Score"];
        const tableRows = data.completed.map(e => [
            e.staff_name,
            e.activity_title,
            e.report_name,
            formatDate(e.submitted_at),
            e.status === 'Completed' ? 'Accepted' : 'Returned',
            e.score ? `${e.score}/5` : 'N/A'
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

            {/* Modal Backdrop */}
            {(evaluateModalItem || viewModalItem) && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}></div>
            )}

            {/* View Details Modal for Completed/Returned evaluations */}
            <div className={`modal fade ${viewModalItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="modal-header bg-light border-bottom border-light-subtle px-4 py-3">
                            <h5 className="modal-title fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">description</span>
                                Evaluation Record
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setViewModalItem(null)}></button>
                        </div>
                        {viewModalItem && (
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-start gap-4 flex-wrap mb-4">
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>{viewModalItem.report_name}</div>
                                            <span className="status-badge" style={{
                                                background: viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                color: viewModalItem.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                fontSize: '.7rem'
                                            }}>{viewModalItem.status === 'Completed' ? 'Accepted' : 'Returned'}</span>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '.9rem' }}>Activity: {viewModalItem.activity_title}</div>
                                        <div className="text-muted" style={{ fontSize: '.8rem', marginTop: '4px' }}>
                                            Submitted By: <strong>{viewModalItem.staff_name}</strong> on {formatDate(viewModalItem.submitted_at)}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="text-dark fw-bold mb-1" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>REPORTED PROGRESS</div>
                                        <div className="progress mx-auto" style={{ height: '8px', width: '120px', borderRadius: '4px' }}>
                                            <div className="progress-bar bg-primary" style={{ width: `${viewModalItem.progress || 0}%` }}></div>
                                        </div>
                                        <div className="fw-black text-primary mt-1">{viewModalItem.progress || 0}%</div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="fw-bold text-dark mb-2" style={{ fontSize: '.85rem' }}>Report Summary</div>
                                    <p className="mb-0 text-secondary" style={{ fontSize: '.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                        {viewModalItem.report_summary || 'No summary provided.'}
                                    </p>
                                </div>

                                <h6 className="fw-bold border-bottom pb-2 mb-3 mt-4 text-dark">Your Evaluation Data</h6>
                                <div className="row g-4 align-items-center">
                                    <div className="col-12 col-md-3 text-center">
                                        <div className="score-ring shadow-sm mx-auto mb-2" style={{
                                            width: '64px', height: '64px', borderRadius: '16px',
                                            background: viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.75rem', fontWeight: '900',
                                            color: viewModalItem.status === 'Completed' ? '#16a34a' : '#dc2626',
                                            border: `2px solid ${viewModalItem.status === 'Completed' ? '#bbf7d0' : '#fca5a5'}`
                                        }}>
                                            {viewModalItem.score || '-'}
                                        </div>
                                        <div className="d-flex gap-1 justify-content-center">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <span key={s} className="material-symbols-outlined" style={{
                                                    fontSize: '14px',
                                                    color: s <= (viewModalItem.score || 0) ? '#f59e0b' : '#e2e8f0',
                                                    fontVariationSettings: "'FILL' 1"
                                                }}>star</span>
                                            ))}
                                        </div>
                                        <div className="fw-bold text-muted small mt-1">{viewModalItem.score ? `${viewModalItem.score}/5 Rating` : 'No Score'}</div>
                                    </div>
                                    <div className="col-12 col-md-9">
                                        <div className="p-3 rounded-3" style={{
                                            background: viewModalItem.status === 'Completed' ? '#f0fdf4' : '#fff1f2',
                                            borderLeft: `4px solid ${viewModalItem.status === 'Completed' ? '#22c55e' : '#ef4444'}`
                                        }}>
                                            <div className="fw-bold text-dark mb-1" style={{ fontSize: '.85rem' }}>Reviewer Comments</div>
                                            <p className="mb-0 text-dark" style={{ fontSize: '.9rem', lineHeight: '1.6' }}>
                                                {viewModalItem.reviewer_notes ? `"${viewModalItem.reviewer_notes}"` : 'No additional comments provided.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="modal-footer bg-light border-top border-light-subtle px-4 py-3">
                            <button type="button" className="btn btn-secondary fw-bold px-4" style={{ borderRadius: '8px' }} onClick={() => setViewModalItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Evaluate Modal for Pending evaluations */}
            <div className={`modal fade ${evaluateModalItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="modal-header bg-warning-subtle border-bottom border-warning-subtle px-4 py-3">
                            <h5 className="modal-title fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-warning">rate_review</span>
                                Evaluate Submission
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setEvaluateModalItem(null)}></button>
                        </div>
                        {evaluateModalItem && (
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-start gap-4 flex-wrap mb-4">
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>{evaluateModalItem.report_name}</div>
                                            <span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '.7rem' }}>Under Review</span>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '.9rem' }}>Activity: {evaluateModalItem.activity_title}</div>
                                        <div className="text-muted" style={{ fontSize: '.8rem', marginTop: '4px' }}>
                                            Submitted By: <strong>{evaluateModalItem.staff_name}</strong> on {formatDate(evaluateModalItem.submitted_at)}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="text-dark fw-bold mb-1" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>REPORTED PROGRESS</div>
                                        <div className="progress mx-auto" style={{ height: '8px', width: '120px', borderRadius: '4px' }}>
                                            <div className="progress-bar bg-primary" style={{ width: `${evaluateModalItem.progress || 0}%` }}></div>
                                        </div>
                                        <div className="fw-black text-primary mt-1">{evaluateModalItem.progress || 0}%</div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="fw-bold text-dark mb-2" style={{ fontSize: '.85rem' }}>Report Summary</div>
                                    <p className="mb-0 text-secondary" style={{ fontSize: '.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                        {evaluateModalItem.report_summary || 'No summary provided.'}
                                    </p>
                                </div>

                                <h6 className="fw-bold border-bottom pb-2 mb-3 mt-4 text-dark">Submit Your Evaluation</h6>
                                <div className="row g-4 align-items-center bg-light p-3 rounded-3">
                                    <div className="col-12 col-md-4">
                                        <div className="fw-bold text-dark mb-2 small">QUALITY SCORE (1–5)</div>
                                        <div className="d-flex gap-2 bg-white d-inline-flex p-2 rounded-3 shadow-sm border border-light-subtle">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button
                                                    key={star}
                                                    onClick={() => handleScore(evaluateModalItem.id, star)}
                                                    className="btn p-0 border-0"
                                                    style={{
                                                        color: star <= (scores[evaluateModalItem.id] || 0) ? '#f59e0b' : '#e2e8f0',
                                                        transition: 'color 0.2s',
                                                        outline: 'none',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1" }}>star</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="text-muted small mt-2" style={{ fontSize: '.75rem' }}>
                                            {scores[evaluateModalItem.id] ? `Rating: ${scores[evaluateModalItem.id]}/5` : 'Required to Mark Completed'}
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-8">
                                        <div className="fw-bold text-dark mb-2 small">EVALUATOR COMMENTS</div>
                                        <textarea
                                            className="form-control border-light-subtle shadow-sm"
                                            rows={3}
                                            placeholder="Provide constructive feedback, notes, or instructions for revision..."
                                            value={comments[evaluateModalItem.id] || ''}
                                            onChange={(e) => handleComment(evaluateModalItem.id, e.target.value)}
                                            style={{ borderRadius: '10px', fontSize: '.9rem' }}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="modal-footer bg-light border-top border-light-subtle px-4 py-3 d-flex justify-content-between">
                            <button
                                className="btn btn-outline-danger fw-bold px-4 d-flex align-items-center gap-2"
                                style={{ borderRadius: '8px' }}
                                onClick={() => evaluateModalItem && handleSubmitEvaluation(evaluateModalItem.id, 'Returned')}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>reply</span>
                                Return for Revision
                            </button>
                            <button
                                className="btn btn-success fw-bold px-4 d-flex align-items-center gap-2 shadow-sm"
                                style={{ borderRadius: '8px' }}
                                onClick={() => evaluateModalItem && handleSubmitEvaluation(evaluateModalItem.id, 'Completed')}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                Mark as Completed
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Evaluations Table */}
            <div className="table-card mb-4 shadow-sm border-0" style={{ borderTop: '4px solid var(--mubs-yellow)' }}>
                <div className="table-card-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
                    <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-warning" style={{ fontSize: '24px' }}>pending_actions</span>
                        Pending Evaluations
                        <span className="badge rounded-pill bg-warning text-dark ms-2" style={{ fontSize: '.75rem' }}>
                            {data.pending.length} to review
                        </span>
                    </h5>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Staff</th>
                                <th>Report / Task</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                <th className="pe-4 text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.pending.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-5 text-muted">
                                        <span className="material-symbols-outlined d-block mb-2 text-warning" style={{ fontSize: '48px', opacity: .4 }}>task_alt</span>
                                        All caught up! No pending evaluations.
                                    </td>
                                </tr>
                            ) : (
                                data.pending.map((e) => (
                                    <tr key={e.id}>
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center gap-2 py-1">
                                                <div className="staff-avatar" style={{
                                                    background: 'var(--mubs-blue)',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    fontWeight: 'bold',
                                                    fontSize: '.75rem'
                                                }}>
                                                    {getInitials(e.staff_name)}
                                                </div>
                                                <span className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{e.staff_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{e.report_name}</div>
                                            <div className="text-muted text-truncate" style={{ fontSize: '.75rem', maxWidth: '250px' }}>{e.activity_title}</div>
                                        </td>
                                        <td style={{ fontSize: '.8rem', color: '#64748b' }}>{formatDate(e.submitted_at)}</td>
                                        <td>
                                            <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207', fontSize: '.65rem' }}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td className="pe-4 text-end">
                                            <button
                                                className="btn btn-sm btn-primary fw-bold py-1 px-3 d-inline-flex align-items-center gap-1 shadow-sm"
                                                style={{ fontSize: '.74rem', borderRadius: '8px' }}
                                                onClick={() => setEvaluateModalItem(e)}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rate_review</span> Evaluate
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Evaluations Table */}
            <div className="table-card shadow-sm border-0 border-top border-4 border-primary">
                <div className="table-card-header bg-white border-bottom py-3 px-4">
                    <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-primary">history_edu</span>
                        Recent Evaluations
                    </h5>
                    <div className="ms-auto d-flex gap-2">
                        <button
                            className="btn btn-sm btn-outline-success fw-bold d-flex align-items-center gap-2 px-3"
                            onClick={handleExportExcel}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table</span>
                            Export Excel
                        </button>
                        <button
                            className="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center gap-2 px-3"
                            onClick={handleExportPDF}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>picture_as_pdf</span>
                            Export PDF
                        </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Staff</th>
                                <th>Report / Task</th>
                                <th>Date Evaluated</th>
                                <th>Score</th>
                                <th>Outcome</th>
                                <th className="pe-4 text-end">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.completed.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-5 text-muted">
                                        No completed evaluations found.
                                    </td>
                                </tr>
                            ) : (
                                data.completed.map((e) => (
                                    <tr key={e.id}>
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center gap-2 py-1">
                                                <div className="staff-avatar" style={{
                                                    background: '#64748b',
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    fontWeight: 'bold',
                                                    fontSize: '.65rem'
                                                }}>
                                                    {getInitials(e.staff_name)}
                                                </div>
                                                <span className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{e.staff_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{e.report_name}</div>
                                        </td>
                                        <td style={{ fontSize: '.8rem', color: '#64748b' }}>{formatDate(e.submitted_at)}</td>
                                        <td>
                                            <span className="score-badge d-inline-flex align-items-center gap-1" style={{
                                                background: e.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                color: e.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                fontSize: '.75rem',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontWeight: 700
                                            }}>
                                                {[1, 2, 3, 4, 5].map(s => <span key={s} className="material-symbols-outlined" style={{
                                                    fontSize: '10px',
                                                    fontVariationSettings: "'FILL' 1",
                                                    color: s <= (e.score || 0) ? '#f59e0b' : (e.status === 'Completed' ? '#bbf7d0' : '#fca5a5')
                                                }}>star</span>)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{
                                                background: e.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                color: e.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                fontSize: '.65rem'
                                            }}>{e.status === 'Completed' ? 'Accepted' : 'Returned'}</span>
                                        </td>
                                        <td className="pe-4 text-end">
                                            <button
                                                className="btn btn-sm btn-outline-secondary fw-bold py-1 px-3 d-inline-flex align-items-center gap-1 shadow-sm"
                                                style={{ fontSize: '.74rem', borderRadius: '8px', background: '#fff' }}
                                                onClick={() => setViewModalItem(e)}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span> View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
