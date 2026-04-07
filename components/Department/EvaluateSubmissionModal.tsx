'use client';

import React from 'react';

export interface EvaluateSubmissionItem {
    id: number;
    report_name: string;
    activity_title: string;
    staff_name: string;
    submitted_at: string;
    report_summary: string;
    attachments?: string | null;
    task_type?: 'process' | 'kpi_driver';
    kpi_actual_value?: number | null;
}

export function parseEvidenceItems(attachments?: string | null): { label: string; url: string }[] {
    if (!attachments) return [];
    return attachments
        .split('|')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => {
            const isUpload = part.startsWith('/uploads/');
            const label = isUpload ? 'Uploaded file' : 'Evidence link';
            return { label, url: part };
        });
}

type RatingChoice = 'Complete' | 'Incomplete' | 'Not Done';

export type FeedbackHistoryEntry = {
    body: string;
    created_at: string;
    author_name?: string | null;
};

interface EvaluateSubmissionModalProps {
    item: EvaluateSubmissionItem | null;
    open: boolean;
    onClose: () => void;
    formatDate: (dateStr: string) => string;
    selectedRating: { [key: number]: RatingChoice };
    onSelectRating: (id: number, rating: RatingChoice) => void;
    comments: { [key: number]: string };
    onCommentChange: (id: number, comment: string) => void;
    kpiActualValues: { [key: number]: string };
    onKpiActualChange: (id: number, value: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    /** Modal dialog z-index (e.g. 1050 on evaluations page, 1070 when stacked on tasks) */
    zIndex?: number;
    /** Prior feedback entries (append-only timeline) when table exists */
    feedbackHistory?: FeedbackHistoryEntry[];
    error?: string | null;
    success?: string | null;
}

const EvaluateSubmissionModal: React.FC<EvaluateSubmissionModalProps> = ({
    item,
    open,
    onClose,
    formatDate,
    selectedRating,
    onSelectRating,
    comments,
    onCommentChange,
    kpiActualValues,
    onKpiActualChange,
    onSubmit,
    isSubmitting,
    zIndex = 1050,
    feedbackHistory = [],
    error,
    success
}) => {
    if (!open || !item) return null;

    const isProcessReview = item.task_type !== 'kpi_driver';
    const ratingLabel = isProcessReview ? 'Review decision' : 'Performance rating';
    const choiceLabel = (opt: RatingChoice) => {
        if (isProcessReview) {
            if (opt === 'Complete') return 'Approve completion';
            if (opt === 'Incomplete') return 'Request revision';
            return 'Mark not done';
        }
        if (opt === 'Complete') return 'Complete';
        if (opt === 'Incomplete') return 'Incomplete (1 pt)';
        return 'Not Done (0 pts)';
    };

    return (
        <div className={`modal fade ${open ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                    <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                        <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>
                                {isProcessReview ? 'fact_check' : 'rate_review'}
                            </span>
                            {isProcessReview ? 'Review submission' : 'Evaluate submission'}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose} disabled={isSubmitting} aria-label="Close" />
                    </div>

                    <div className="modal-body p-4 pt-3">
                        {error && (
                            <div className="alert alert-danger py-2 px-3 mb-4 border-0 shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '10px', fontSize: '0.85rem' }}>
                                <span className="material-symbols-outlined fs-5">error</span>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="alert alert-success py-2 px-3 mb-4 border-0 shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '10px', fontSize: '0.85rem' }}>
                                <span className="material-symbols-outlined fs-5">check_circle</span>
                                {success}
                            </div>
                        )}
                        <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                                <div>
                                    <div className="fw-bold text-dark mb-2" style={{ fontSize: '1.05rem' }}>
                                        {item.report_name}
                                        <span
                                            className="badge ms-2 fw-semibold"
                                            style={{
                                                background: '#eff6ff',
                                                color: 'var(--mubs-blue)',
                                                fontSize: '.75rem',
                                                verticalAlign: 'middle',
                                            }}
                                        >
                                            Pending
                                        </span>
                                    </div>
                                    <div className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                                        <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>
                                            category
                                        </span>
                                        {item.activity_title}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>
                                            person
                                        </span>
                                        By <strong>{item.staff_name}</strong>
                                        <span className="text-muted ms-1">&middot; {formatDate(item.submitted_at)}</span>
                                    </div>
                                </div>
                            </div>
                            {item.report_summary && (
                                <div className="mt-3 pt-3 border-top border-light">
                                    <div className="fw-semibold text-dark mb-1" style={{ fontSize: '0.8rem' }}>
                                        Summary
                                    </div>
                                    <p
                                        className="mb-0 text-secondary"
                                        style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}
                                    >
                                        {item.report_summary}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-semibold mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>
                                    attach_file
                                </span>
                                Evidence
                            </label>
                            {parseEvidenceItems(item.attachments).length === 0 ? (
                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    No evidence file or link attached for this submission.
                                </div>
                            ) : (
                                <div className="d-flex flex-wrap gap-3">
                                    {parseEvidenceItems(item.attachments).map((ev, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="btn btn-outline-primary d-inline-flex align-items-center gap-2 px-3"
                                            style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                                            onClick={() => {
                                                try {
                                                    window.open(ev.url, '_blank', 'noopener,noreferrer');
                                                } catch (e) {
                                                    console.error('Error opening evidence url', e);
                                                }
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                                visibility
                                            </span>
                                            {ev.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="row g-4">
                            <div className="col-12">
                                <label className="form-label fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>
                                    {ratingLabel} <span className="text-danger">*</span>
                                </label>
                                {isProcessReview ? (
                                    <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                                    </p>
                                ) : null}
                                <div className="d-flex gap-3">
                                    {(['Complete', 'Incomplete', 'Not Done'] as const).map((opt) => (
                                        <div
                                            key={opt}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onSelectRating(item.id, opt);
                                                }
                                            }}
                                            onClick={() => onSelectRating(item.id, opt)}
                                            className="flex-fill text-center p-3 rounded-3 cursor-pointer border shadow-sm"
                                            style={{
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                fontWeight: 'bold',
                                                transition: 'all 0.2s',
                                                borderColor: selectedRating[item.id] === opt ? 'var(--mubs-blue)' : '#e2e8f0',
                                                background: selectedRating[item.id] === opt ? 'var(--mubs-blue)' : '#fff',
                                                color: selectedRating[item.id] === opt ? '#fff' : '#475569',
                                                borderRadius: '12px',
                                            }}
                                        >
                                            {choiceLabel(opt)}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {item.task_type === 'kpi_driver' && (
                                <div className="col-12">
                                    <label className="form-label fw-semibold mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>
                                            analytics
                                        </span>
                                        Achieved value
                                    </label>
                                    <div className="d-flex align-items-center gap-4">
                                        <input
                                            type="number"
                                            className="form-control fw-bold border-primary-subtle shadow-sm px-3"
                                            min={0}
                                            step="any"
                                            placeholder="0"
                                            value={kpiActualValues[item.id] ?? ''}
                                            onChange={(e) => onKpiActualChange(item.id, e.target.value)}
                                            style={{ maxWidth: '120px', borderRadius: '10px', fontSize: '1rem' }}
                                        />
                                        {item.kpi_actual_value != null && (
                                            <div className="text-muted border-start ps-3 py-1">
                                                <div style={{ fontSize: '.65rem', fontWeight: 'bold' }}>STAFF ENTERED:</div>
                                                <div className="text-dark fw-black" style={{ fontSize: '1rem' }}>
                                                    {item.kpi_actual_value}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="col-12">
                                {feedbackHistory.length > 0 && (
                                    <div className="mb-3 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <div className="fw-semibold text-dark mb-2" style={{ fontSize: '0.8rem' }}>
                                            Feedback history
                                        </div>
                                        <ul className="list-unstyled mb-0 small text-secondary" style={{ fontSize: '0.82rem' }}>
                                            {feedbackHistory.map((ev, i) => (
                                                <li key={i} className="mb-2 pb-2 border-bottom border-light">
                                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                        {formatDate(ev.created_at)}
                                                        {ev.author_name ? ` · ${ev.author_name}` : ''}
                                                    </div>
                                                    <div className="text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                                                        {ev.body}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <label className="form-label fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>
                                    {isProcessReview ? 'Comments / feedback' : 'Reviewer feedback'}{' '}
                                    {selectedRating[item.id] === 'Incomplete' && <span className="text-danger">*</span>}
                                </label>
                                <textarea
                                    className="form-control shadow-sm"
                                    rows={3}
                                    placeholder={
                                        selectedRating[item.id] === 'Incomplete'
                                            ? isProcessReview
                                                ? 'Required when requesting revision. What should staff change or add?'
                                                : 'Required for Incomplete. Explain why...'
                                            : isProcessReview
                                              ? 'Optional notes for the staff record…'
                                              : 'Optional feedback...'
                                    }
                                    value={comments[item.id] || ''}
                                    onChange={(e) => onCommentChange(item.id, e.target.value)}
                                    style={{ borderRadius: '10px', fontSize: '.9rem', resize: 'none' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer bg-light border-top-0 py-3 px-4 d-flex justify-content-end align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-primary fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
                            style={{
                                borderRadius: '8px',
                                fontSize: '.9rem',
                                background: 'var(--mubs-blue)',
                                borderColor: 'var(--mubs-blue)',
                            }}
                            onClick={onSubmit}
                            disabled={isSubmitting || !selectedRating[item.id]}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                send
                            </span>
                            {isSubmitting ? 'Saving…' : isProcessReview ? 'Save review' : 'Submit evaluation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaluateSubmissionModal;
