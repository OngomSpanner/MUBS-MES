"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';


interface FeedbackItem {
    id: number;
    activity_title: string;
    report_name: string;
    evaluator_name: string;
    evaluated_at: string;
    status: string;
    reviewer_notes: string;
}

interface Stats {
    totalEvaluations: number;
    completionRate: number;
    returnedCount: number;
    incompleteCount: number;
}

const defaultStats: Stats = {
    totalEvaluations: 0,
    completionRate: 0,
    returnedCount: 0,
    incompleteCount: 0
};

export default function StaffFeedback() {
    const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const response = await axios.get('/api/staff/feedback');
                const feedback = Array.isArray(response.data?.feedback) ? response.data.feedback : [];
                const statsData = response.data?.stats;
                setFeedbackList(feedback);
                setStats(statsData && typeof statsData === 'object' ? statsData : defaultStats);
            } catch (error) {
                console.error("Failed to fetch feedback", error);
                setFeedbackList([]);
                setStats(defaultStats);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    // const avgScoreNum = parseFloat(stats.averageScore);
    // const fullStars = Math.floor(avgScoreNum);

    return (
        <div className="content-area w-100 position-relative">
            {/* Detailed Feedback Modal */}
            {selectedItem && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}></div>
            )}
            <div className={`modal fade ${selectedItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="modal-header bg-light border-bottom border-light-subtle px-4 py-3">
                            <h5 className="modal-title fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">feedback</span>
                                Evaluation Details
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setSelectedItem(null)}></button>
                        </div>
                        {selectedItem && (
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-center gap-3 mb-4">
                                    <div className="flex-fill">
                                        <div className="fw-black text-dark" style={{ fontSize: '1.2rem', wordBreak: 'break-word' }}>{selectedItem.report_name}</div>
                                        <div className="text-muted mt-1" style={{ fontSize: '.9rem' }}>{selectedItem.activity_title}</div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                        <span className="text-muted fw-bold" style={{ fontSize: '.75rem' }}>EVALUATOR</span>
                                        <span className="text-dark fw-bold text-end" style={{ fontSize: '.85rem' }}>{selectedItem.evaluator_name || 'Department Head'}</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                        <span className="text-muted fw-bold" style={{ fontSize: '.75rem' }}>DATE</span>
                                        <span className="text-dark fw-bold" style={{ fontSize: '.85rem' }}>{formatDate(selectedItem.evaluated_at)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="text-muted fw-bold" style={{ fontSize: '.75rem' }}>OUTCOME</span>
                                        <span className="badge" style={{
                                            background: selectedItem.status === 'Completed' ? '#dcfce7' : selectedItem.status === 'Not Done' ? '#f1f5f9' : '#fef3c7',
                                            color: selectedItem.status === 'Completed' ? '#15803d' : selectedItem.status === 'Not Done' ? '#475569' : '#b45309'
                                        }}>
                                            {selectedItem.status === 'Completed' ? 'Complete' : selectedItem.status === 'Incomplete' ? 'Incomplete' : selectedItem.status === 'Not Done' ? 'Not Done' : 'Returned for Revision'}
                                        </span>
                                    </div>
                                </div>

                                <div className="fw-bold text-dark mb-2" style={{ fontSize: '.85rem' }}>Reviewer Comments / Instructions</div>
                                <div className="p-3 rounded-3" style={{
                                    background: selectedItem.status === 'Completed' ? '#f0fdf4' : selectedItem.status === 'Not Done' ? '#f1f5f9' : '#fff7ed',
                                    borderLeft: `4px solid ${selectedItem.status === 'Completed' ? '#22c55e' : selectedItem.status === 'Not Done' ? '#64748b' : '#f59e0b'}`
                                }}>
                                    <p className="mb-0 text-dark" style={{ fontSize: '.95rem', lineHeight: '1.6' }}>
                                        {selectedItem.reviewer_notes ? `"${selectedItem.reviewer_notes}"` : 'No additional comments provided.'}
                                    </p>
                                </div>

                                {(selectedItem.status === 'Returned' || selectedItem.status === 'Incomplete') && (
                                    <div className="mt-4 pt-3 border-top text-end">
                                        <a href="/staff?pg=submissions" className="btn btn-warning fw-bold shadow-sm px-4" style={{ borderRadius: '8px', color: '#854d0e' }}>
                                            Revise & Resubmit
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Modal footer removed per request */}
                    </div>
                </div>
            </div>

            {/* Performance summary banner */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#0f172a,var(--mubs-navy))', border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-4">
                        <div className="text-white-50 fw-bold" style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>Performance Summary</div>
                        <div className="fw-black text-white mt-2" style={{ fontSize: '2rem', lineHeight: '1' }}>Feedback Overview</div>
                    </div>
                    <div className="col-12 col-md-8">
                        <div className="row g-3 text-center">
                            <div className="col-4">
                                <div className="fw-black text-white" style={{ fontSize: '1.5rem' }}>{stats.totalEvaluations}</div>
                                <div className="text-white-50" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Evaluations</div>
                            </div>
                            <div className="col-4">
                                <div className="fw-black" style={{ fontSize: '1.5rem', color: 'var(--mubs-yellow)' }}>{stats.completionRate}%</div>
                                <div className="text-white-50" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Success Rate</div>
                            </div>
                            <div className="col-4">
                                <div className="fw-black" style={{ fontSize: '1.5rem', color: stats.incompleteCount > 0 ? '#ef4444' : '#fff' }}>{stats.incompleteCount}</div>
                                <div className="text-white-50" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Incomplete</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-12">
                    <div className="table-card shadow-sm border-0 mb-4" style={{ borderTop: '4px solid #10b981' }}>
                        <div className="table-card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-success">reviews</span>
                                Recent Feedback & Evaluations
                            </h5>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4">Task / Report Name</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th className="pe-4 text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {feedbackList.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-5 text-muted">
                                                <span className="material-symbols-outlined d-block mb-2 text-secondary" style={{ fontSize: '32px' }}>inbox</span>
                                                You have no evaluated tasks yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        feedbackList.map(item => (
                                            <tr key={item.id}>
                                                <td className="ps-4 py-3">
                                                    <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>{item.report_name}</div>
                                                    <div className="text-muted text-truncate" style={{ fontSize: '.75rem', maxWidth: '250px' }}>
                                                        {item.activity_title}
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '.85rem', color: '#64748b' }}>{formatDate(item.evaluated_at)}</td>
                                                <td>
                                                    <span className="badge" style={{
                                                        background: item.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                        color: item.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                        fontWeight: 'bold',
                                                        letterSpacing: '.02em'
                                                    }}>
                                                        {item.status === 'Completed' ? 'ACCEPTED' : 'RETURNED'}
                                                    </span>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    <button
                                                        className="btn btn-sm btn-light fw-bold px-3 shadow-sm"
                                                        style={{ borderRadius: '8px', fontSize: '.75rem' }}
                                                        onClick={() => setSelectedItem(item)}
                                                    >
                                                        Details
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
            </div>
        </div>
    );
}
