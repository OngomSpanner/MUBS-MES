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
    score: number;
    reviewer_notes: string;
}

interface Stats {
    totalEvaluations: number;
    averageScore: string;
    completionRate: number;
    returnedCount: number;
}

export default function StaffFeedback() {
    const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const response = await axios.get('/api/staff/feedback');
                setFeedbackList(response.data.feedback);
                setStats(response.data.stats);
            } catch (error) {
                console.error("Failed to fetch feedback", error);
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

    if (loading || !stats) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const avgScoreNum = parseFloat(stats.averageScore);
    const fullStars = Math.floor(avgScoreNum);

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
                                    <div className="score-ring shadow-sm" style={{
                                        width: '64px', height: '64px', borderRadius: '16px',
                                        background: selectedItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.75rem', fontWeight: '900',
                                        color: selectedItem.status === 'Completed' ? '#16a34a' : '#dc2626',
                                        border: `2px solid ${selectedItem.status === 'Completed' ? '#bbf7d0' : '#fca5a5'}`
                                    }}>
                                        {selectedItem.score || '-'}
                                    </div>
                                    <div className="flex-fill">
                                        <div className="fw-black text-dark" style={{ fontSize: '1.1rem', wordBreak: 'break-word' }}>{selectedItem.report_name}</div>
                                        <div className="text-muted mt-1" style={{ fontSize: '.85rem' }}>{selectedItem.activity_title}</div>
                                        <div className="d-flex gap-1 mt-2">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <span key={s} className="material-symbols-outlined" style={{
                                                    fontSize: '16px',
                                                    color: s <= selectedItem.score ? '#f59e0b' : '#e2e8f0',
                                                    fontVariationSettings: "'FILL' 1"
                                                }}>star</span>
                                            ))}
                                        </div>
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
                                            background: selectedItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                            color: selectedItem.status === 'Completed' ? '#15803d' : '#b91c1c'
                                        }}>
                                            {selectedItem.status === 'Completed' ? 'Accepted' : 'Returned for Revision'}
                                        </span>
                                    </div>
                                </div>

                                <div className="fw-bold text-dark mb-2" style={{ fontSize: '.85rem' }}>Reviewer Comments / Instructions</div>
                                <div className="p-3 rounded-3" style={{
                                    background: selectedItem.status === 'Completed' ? '#f0fdf4' : '#fff1f2',
                                    borderLeft: `4px solid ${selectedItem.status === 'Completed' ? '#22c55e' : '#ef4444'}`
                                }}>
                                    <p className="mb-0 text-dark" style={{ fontSize: '.95rem', lineHeight: '1.6' }}>
                                        {selectedItem.reviewer_notes ? `"${selectedItem.reviewer_notes}"` : 'No additional comments provided.'}
                                    </p>
                                </div>

                                {selectedItem.status === 'Returned' && (
                                    <div className="mt-4 pt-3 border-top text-end">
                                        <button className="btn btn-danger fw-bold shadow-sm px-4" style={{ borderRadius: '8px' }}>
                                            Go to Task to Revise
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="modal-footer bg-light border-top border-light-subtle px-4 py-3">
                            <button type="button" className="btn btn-secondary fw-bold px-4" style={{ borderRadius: '8px' }} onClick={() => setSelectedItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance summary banner */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#0f172a,var(--mubs-navy))', border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-6">
                        <div className="text-white-50 fw-bold" style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>My Overall Score</div>
                        <div className="d-flex align-items-end gap-3 mt-1">
                            <div className="fw-black text-white" style={{ fontSize: '3.5rem', lineHeight: '1' }}>{stats.averageScore}</div>
                            <div>
                                <div className="star-display" style={{ color: 'var(--mubs-yellow)', fontSize: '1.3rem', letterSpacing: '2px' }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <span key={s} className={s <= fullStars ? "" : "star-empty"} style={s > fullStars ? { color: '#e2e8f0' } : {}}>★</span>
                                    ))}
                                </div>
                                <div className="text-white-50" style={{ fontSize: '.78rem' }}>
                                    {avgScoreNum >= 4 ? 'Excellent Performance' : avgScoreNum >= 3 ? 'Good Performance' : avgScoreNum > 0 ? 'Needs Improvement' : 'No Ratings Yet'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
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
                                <div className="fw-black" style={{ fontSize: '1.5rem', color: stats.returnedCount > 0 ? '#ef4444' : '#fff' }}>{stats.returnedCount}</div>
                                <div className="text-white-50" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Returned</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-12 col-lg-8">
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
                                        <th>Score</th>
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
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="fw-black" style={{ color: item.status === 'Completed' ? '#059669' : '#dc2626' }}>
                                                            {item.score ? `${item.score}/5` : '-'}
                                                        </div>
                                                        <div className="d-flex gap-1">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <span key={s} className="material-symbols-outlined" style={{
                                                                    fontSize: '12px',
                                                                    color: s <= item.score ? '#f59e0b' : '#e2e8f0',
                                                                    fontVariationSettings: "'FILL' 1"
                                                                }}>star</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
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

                {/* Score summary panel */}
                <div className="col-12 col-lg-4">
                    <div className="table-card mb-4 shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3 px-4">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">bar_chart</span>
                                Score Breakdown
                            </h5>
                        </div>
                        <div className="p-4">
                            <div className="text-center mb-4">
                                <div className="perf-ring mb-2 position-relative d-inline-flex align-items-center justify-content-center">
                                    <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="#005696" strokeWidth="12"
                                            strokeDasharray="314"
                                            strokeDashoffset={314 - (stats.totalEvaluations > 0 ? (avgScoreNum / 5) * 314 : 0)}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                                        />
                                    </svg>
                                    <div className="perf-ring-label position-absolute text-center">
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a' }}>{stats.averageScore}</div>
                                        <div style={{ fontSize: '.65rem', color: '#64748b', fontWeight: '700' }}>out of 5</div>
                                    </div>
                                </div>
                                <div className="star-display" style={{ fontSize: '1.4rem', color: 'var(--mubs-yellow)', letterSpacing: '2px' }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <span key={s} className={s <= fullStars ? "" : "star-empty"} style={s > fullStars ? { color: '#e2e8f0' } : {}}>★</span>
                                    ))}
                                </div>
                                <div className="fw-bold text-muted mt-1" style={{ fontSize: '.78rem' }}>Based on {stats.totalEvaluations} evaluations</div>
                            </div>

                            <div className="d-flex flex-column gap-3 mb-4">
                                {feedbackList.slice(0, 4).map(item => (
                                    <div key={item.id}>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span className="text-dark fw-bold text-truncate" style={{ fontSize: '.8rem', maxWidth: '70%' }}>{item.report_name}</span>
                                            <span className={`badge ${item.status === 'Completed' ? 'bg-success' : 'bg-danger'}`}>{item.score || 0}.0</span>
                                        </div>
                                        <div className="progress" style={{ height: '6px' }}>
                                            <div className={`progress-bar ${item.status === 'Completed' ? 'bg-success' : 'bg-danger'}`} style={{ width: `${(item.score / 5) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                                {feedbackList.length === 0 && (
                                    <div className="text-center text-muted small py-3">No scores to display.</div>
                                )}
                            </div>

                            <div className="mt-2 p-3 rounded-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                <div className="fw-bold text-dark mb-2 d-flex align-items-center gap-2" style={{ fontSize: '.85rem' }}>
                                    <span className="material-symbols-outlined text-warning" style={{ fontSize: '18px' }}>tips_and_updates</span>
                                    Tips to Improve
                                </div>
                                <ul className="mb-0 text-dark" style={{ fontSize: '.8rem', lineHeight: '1.6', paddingLeft: '1.2rem' }}>
                                    <li className="mb-1">Always attach relevant evidence to your reports.</li>
                                    <li className="mb-1">Submit your progress updates ahead of deadlines.</li>
                                    <li>If returned, read the reviewer notes carefully before resubmitting.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
