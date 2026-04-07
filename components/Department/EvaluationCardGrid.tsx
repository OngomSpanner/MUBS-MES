"use client";

import React from 'react';

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

interface EvaluationCardGridProps {
    evaluations: Evaluation[];
    onEvaluate: (e: Evaluation) => void;
    onView: (e: Evaluation) => void;
    isPending: (e: Evaluation) => boolean;
}

const EvaluationCardGrid: React.FC<EvaluationCardGridProps> = ({ evaluations, onEvaluate, onView, isPending }) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    };

    const getStatusStyle = (evaluation: Evaluation, pending: boolean) => {
        if (pending) return { bg: '#fef9c3', color: '#a16207', icon: 'hourglass_empty', label: 'Pending' };
        if (evaluation.status === 'Completed') return { bg: '#dcfce7', color: '#15803d', icon: 'check_circle', label: 'Accepted' };
        if (evaluation.status === 'Not Done') return { bg: '#f1f5f9', color: '#475569', icon: 'cancel', label: 'Not Done' };
        return { bg: '#fef3c7', color: '#b45309', icon: 'feedback', label: evaluation.status === 'Incomplete' ? 'Incomplete' : 'Returned' };
    };

    const getRatingColor = (score?: number | null) => {
        if (score === 2) return '#15803d'; // Complete
        if (score === 1) return '#b45309'; // Incomplete
        if (score === 0) return '#b91c1c'; // Not Done
        return '#64748b';
    };

    return (
        <div className="row g-4">
            {evaluations.map((e) => {
                const pending = isPending(e);
                const status = getStatusStyle(e, pending);
                const avatarBg = pending ? 'var(--mubs-blue)' : (e.status === 'Completed' ? '#10b981' : e.status === 'Not Done' ? '#64748b' : '#f59e0b');

                return (
                    <div key={e.id} className="col-12 col-md-6 col-xxl-4">
                        <div 
                            className="evaluation-card h-100 p-4 bg-white border rounded-4 shadow-sm d-flex flex-column"
                            style={{ 
                                transition: 'all 0.3s ease',
                                borderTop: `6px solid ${avatarBg}`,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                        >
                            <div className="d-flex justify-content-between align-items-start mb-3">
                                <div className="d-flex align-items-center gap-2 overflow-hidden">
                                    <div className="staff-avatar" style={{
                                        background: avatarBg,
                                        width: '38px', height: '38px', borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: 'bold', fontSize: '.8rem', flexShrink: 0
                                    }}>
                                        {getInitials(e.staff_name)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="fw-bold text-dark" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{e.staff_name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Submitted {formatDate(e.submitted_at)}</div>
                                    </div>
                                </div>
                                <span className="status-badge px-2 py-1 rounded-pill d-flex align-items-center gap-1" style={{ background: status.bg, color: status.color, fontSize: '0.65rem', fontWeight: '700' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{status.icon}</span>
                                    {status.label}
                                </span>
                            </div>

                            <div className="flex-fill">
                                <h6 className="fw-bold text-dark mb-1" style={{ wordBreak: 'break-word' }}>{e.report_name}</h6>
                                <div className="text-muted mb-3 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>category</span>
                                    {e.activity_title}
                                </div>

                                <div className="progress-section mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="small text-muted fw-bold" style={{ fontSize: '0.65rem' }}>STAFF PROGRESS</span>
                                        <span className="small fw-bold" style={{ fontSize: '0.7rem' }}>{e.progress || 0}%</span>
                                    </div>
                                    <div className="progress" style={{ height: '6px', borderRadius: '10px', background: '#f1f5f9' }}>
                                        <div className="progress-bar" style={{ 
                                            width: `${e.progress || 0}%`, 
                                            background: avatarBg,
                                            borderRadius: '10px'
                                        }}></div>
                                    </div>
                                </div>

                                {!pending && (
                                    <div className="evaluation-rating d-flex align-items-center gap-2 p-2 rounded-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                        <div className="d-flex flex-column">
                                            <span className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>RATING</span>
                                            <span className="fw-black" style={{ fontSize: '1rem', color: getRatingColor(e.score) }}>{e.score ?? '-'}</span>
                                        </div>
                                        <div className="vr mx-1" style={{ opacity: 0.1 }}></div>
                                        <div className="d-flex flex-column flex-fill overflow-hidden">
                                            <span className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>FEEDBACK</span>
                                            <span className="text-dark small italic" style={{ fontStyle: 'italic', wordBreak: 'break-word' }}>
                                                {e.reviewer_notes ? `"${e.reviewer_notes}"` : 'No comments provided'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="d-flex justify-content-end mt-auto pt-3 border-top">
                                {pending ? (
                                    <button
                                        className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-1 px-4 py-2 shadow-sm"
                                        style={{ borderRadius: '10px', fontSize: '0.75rem', background: 'var(--mubs-blue)' }}
                                        onClick={() => onEvaluate(e)}
                                        title="Review this submission"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fact_check</span>
                                        Review
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-outline-light border btn-sm fw-bold text-dark d-flex align-items-center gap-1 px-3 py-2"
                                        style={{ borderRadius: '10px', fontSize: '0.75rem' }}
                                        onClick={() => onView(e)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                        View record
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default EvaluationCardGrid;
