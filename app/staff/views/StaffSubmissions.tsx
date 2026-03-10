"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface SubmissionItem {
    id: number;
    activity_title: string;
    report_name: string;
    submitted_at: string;
    status: string;
    score: number;
    progress: number;
    description: string;
    reviewer_notes: string;
}

interface Stats {
    totalSubmitted: number;
    underReview: number;
    reviewed: number;
    returned: number;
}

export default function StaffSubmissions() {
    const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SubmissionItem | null>(null);
    const [filter, setFilter] = useState('All Status');

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const response = await axios.get('/api/staff/submissions');
                setSubmissions(response.data.submissions);
                setStats(response.data.stats);
            } catch (error) {
                console.error("Failed to fetch submissions", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubmissions();
    }, []);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        if (status === 'Under Review') return <span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Under Review</span>;
        if (status === 'Completed') return <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Reviewed</span>;
        if (status === 'Returned') return <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Returned</span>;
        return <span className="status-badge bg-light text-dark">{status}</span>;
    };

    if (loading || !stats) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const filteredSubmissions = filter === 'All Status'
        ? submissions
        : submissions.filter(s => {
            if (filter === 'Reviewed' && s.status === 'Completed') return true;
            return s.status === filter;
        });

    return (
        <div className="content-area w-100 position-relative">
            {/* View Details Modal */}
            {selectedItem && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}></div>
            )}
            <div className={`modal fade ${selectedItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="modal-header bg-light border-bottom border-light-subtle px-4 py-3">
                            <h5 className="modal-title fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">description</span>
                                Submission Details
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setSelectedItem(null)}></button>
                        </div>
                        {selectedItem && (
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-start gap-4 flex-wrap mb-4">
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>{selectedItem.report_name}</div>
                                            {getStatusBadge(selectedItem.status)}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '.9rem' }}>Activity: {selectedItem.activity_title}</div>
                                        <div className="text-muted" style={{ fontSize: '.8rem', marginTop: '4px' }}>Submitted: {formatDate(selectedItem.submitted_at)}</div>
                                    </div>

                                    <div className="text-end">
                                        <div className="text-dark fw-bold mb-1" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>REPORTED PROGRESS</div>
                                        <div className="progress mx-auto" style={{ height: '8px', width: '120px', borderRadius: '4px' }}>
                                            <div className="progress-bar bg-primary" style={{ width: `${selectedItem.progress || 0}%` }}></div>
                                        </div>
                                        <div className="fw-black text-primary mt-1">{selectedItem.progress || 0}%</div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="fw-bold text-dark mb-2" style={{ fontSize: '.85rem' }}>Report Description</div>
                                    <p className="mb-0 text-secondary" style={{ fontSize: '.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                        {selectedItem.description || 'No description provided.'}
                                    </p>
                                </div>

                                {/* Evaluation Section if reviewed */}
                                {(selectedItem.status === 'Completed' || selectedItem.status === 'Returned') && (
                                    <>
                                        <h6 className="fw-bold border-bottom pb-2 mb-3 mt-4 text-dark">Department Head Evaluation</h6>
                                        <div className="row g-4 align-items-center">
                                            <div className="col-12 col-md-3 text-center">
                                                <div className="score-ring shadow-sm mx-auto mb-2" style={{
                                                    width: '64px', height: '64px', borderRadius: '16px',
                                                    background: selectedItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.75rem', fontWeight: '900',
                                                    color: selectedItem.status === 'Completed' ? '#16a34a' : '#dc2626',
                                                    border: `2px solid ${selectedItem.status === 'Completed' ? '#bbf7d0' : '#fca5a5'}`
                                                }}>
                                                    {selectedItem.score || '-'}
                                                </div>
                                                <div className="d-flex gap-1 justify-content-center">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <span key={s} className="material-symbols-outlined" style={{
                                                            fontSize: '14px',
                                                            color: s <= (selectedItem.score || 0) ? '#f59e0b' : '#e2e8f0',
                                                            fontVariationSettings: "'FILL' 1"
                                                        }}>star</span>
                                                    ))}
                                                </div>
                                                <div className="fw-bold text-muted small mt-1">{selectedItem.score ? `${selectedItem.score}/5 Rating` : 'No Score'}</div>
                                            </div>
                                            <div className="col-12 col-md-9">
                                                <div className="p-3 rounded-3" style={{
                                                    background: selectedItem.status === 'Completed' ? '#f0fdf4' : '#fff1f2',
                                                    borderLeft: `4px solid ${selectedItem.status === 'Completed' ? '#22c55e' : '#ef4444'}`
                                                }}>
                                                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '.85rem' }}>Reviewer Comments</div>
                                                    <p className="mb-0 text-dark" style={{ fontSize: '.9rem', lineHeight: '1.6' }}>
                                                        {selectedItem.reviewer_notes ? `"${selectedItem.reviewer_notes}"` : 'No additional comments provided.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        <div className="modal-footer bg-light border-top border-light-subtle px-4 py-3 d-flex justify-content-between">
                            {selectedItem?.status === 'Returned' ? (
                                <button type="button" className="btn btn-danger fw-bold shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '8px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                    Revise & Resubmit Report
                                </button>
                            ) : <div></div>}
                            <button type="button" className="btn btn-secondary fw-bold px-4" style={{ borderRadius: '8px' }} onClick={() => setSelectedItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-blue)', padding: '.9rem' }}>
                        <div className="stat-value" style={{ fontSize: '1.7rem' }}>{stats.totalSubmitted}</div>
                        <div className="stat-label">Total Submitted</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-yellow)', padding: '.9rem' }}>
                        <div className="stat-value" style={{ fontSize: '1.7rem', color: '#b45309' }}>{stats.underReview}</div>
                        <div className="stat-label">Under Review</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeftColor: '#10b981', padding: '.9rem' }}>
                        <div className="stat-value" style={{ fontSize: '1.7rem', color: '#059669' }}>{stats.reviewed}</div>
                        <div className="stat-label">Reviewed & Scored</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-red)', padding: '.9rem' }}>
                        <div className="stat-value" style={{ fontSize: '1.7rem', color: 'var(--mubs-red)' }}>{stats.returned}</div>
                        <div className="stat-label">Returned</div>
                    </div>
                </div>
            </div>

            <div className="table-card">
                <div className="table-card-header bg-white">
                    <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-primary">history_edu</span>
                        Submission History
                    </h5>
                    <div className="d-flex gap-2 flex-wrap ms-auto">
                        <select
                            className="form-select border-light-subtle"
                            style={{ width: '150px', borderRadius: '8px', fontSize: '.85rem', fontWeight: 'bold' }}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="All Status">All Submissions</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Reviewed">Reviewed & Scored</option>
                            <option value="Returned">Returned</option>
                        </select>
                        <button className="btn btn-outline-secondary fw-bold d-flex align-items-center gap-2" style={{ borderRadius: '8px', fontSize: '.85rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>Export
                        </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Report / Task Name</th>
                                <th>Activity</th>
                                <th>Submitted Date</th>
                                <th>Reported Progress</th>
                                <th>Status</th>
                                <th>Score</th>
                                <th className="pe-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubmissions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <span className="material-symbols-outlined d-block mb-2 text-secondary" style={{ fontSize: '32px' }}>inbox</span>
                                        No submissions found matching this status.
                                    </td>
                                </tr>
                            ) : (
                                filteredSubmissions.map(item => (
                                    <tr key={item.id} style={{ background: item.status === 'Returned' ? '#fff1f2' : item.status === 'Completed' ? '#f0fdf4' : '#fff' }}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{item.report_name}</div>
                                        </td>
                                        <td className="text-truncate text-secondary" style={{ fontSize: '.8rem', maxWidth: '200px' }}>
                                            {item.activity_title}
                                        </td>
                                        <td style={{ fontSize: '.8rem', color: '#64748b' }}>{formatDate(item.submitted_at)}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-fill" style={{ height: '6px' }}>
                                                    <div className="progress-bar bg-primary" style={{ width: `${item.progress || 0}%` }}></div>
                                                </div>
                                                <span className="fw-bold text-muted" style={{ fontSize: '.7rem' }}>{item.progress || 0}%</span>
                                            </div>
                                        </td>
                                        <td>{getStatusBadge(item.status)}</td>
                                        <td>
                                            {item.score ? (
                                                <span className="score-badge d-flex align-items-center gap-1" style={{
                                                    background: item.status === 'Completed' ? '#dcfce7' : '#fef9c3',
                                                    color: item.status === 'Completed' ? '#15803d' : '#a16207',
                                                    width: 'fit-content'
                                                }}>
                                                    {[1, 2, 3, 4, 5].map(s => <span key={s} className="material-symbols-outlined fw-black" style={{ color: s <= item.score ? '' : '#cbd5e1', fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>star</span>)}
                                                    <span className="ms-1 fw-bold">{item.score}/5</span>
                                                </span>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '.78rem' }}>—</span>
                                            )}
                                        </td>
                                        <td className="pe-4 text-end">
                                            <div className="d-flex gap-2 justify-content-end">
                                                <button
                                                    className="btn btn-sm btn-light fw-bold px-3 shadow-sm d-flex align-items-center gap-1 border"
                                                    style={{ borderRadius: '8px', fontSize: '.75rem' }}
                                                    onClick={() => setSelectedItem(item)}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span>
                                                    View
                                                </button>
                                                {item.status === 'Returned' && (
                                                    <button className="btn btn-sm btn-danger fw-bold px-3 shadow-sm d-flex align-items-center gap-1" style={{ borderRadius: '8px', fontSize: '.75rem' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                                                    </button>
                                                )}
                                            </div>
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
