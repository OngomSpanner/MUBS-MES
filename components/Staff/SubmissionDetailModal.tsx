"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import axios from 'axios';

interface SubmissionDetailModalProps {
    show: boolean;
    onHide: () => void;
    submission?: any;
    taskId?: number;
    assignmentType?: 'legacy' | 'process_task' | 'process_subtask';
    onRevise?: (submission: any) => void;
}

export default function SubmissionDetailModal({ show, onHide, submission: propSubmission, taskId, assignmentType, onRevise }: SubmissionDetailModalProps) {
    const [submission, setSubmission] = useState<any>(propSubmission || null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && !propSubmission && taskId) {
            const fetchSubmission = async () => {
                setLoading(true);
                try {
                    const res = await axios.get("/api/staff/submissions");
                    const all = res.data.submissions || [];
                    const found =
                        assignmentType === 'process_subtask'
                            ? all.find((s: any) => Number(s.process_subtask_id) === Number(taskId))
                            : all.find((s: any) => Number(s.task_id) === Number(taskId));
                    setSubmission(found);
                } catch (err) {
                    console.error("Error fetching submission:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchSubmission();
        } else if (show && propSubmission) {
            setSubmission(propSubmission);
        }
    }, [show, propSubmission, taskId, assignmentType]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        if (status === 'Under Review' || status === 'submitted') return <span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '0.65rem' }}>Under Review</span>;
        if (status === 'Completed' || status === 'evaluated' || status === 'Complete') return <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.65rem' }}>Complete</span>;
        if (status === 'Incomplete') return <span className="status-badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.65rem' }}>Incomplete</span>;
        if (status === 'Returned' || status === 'draft') return <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.65rem' }}>Returned</span>;
        return <span className="status-badge bg-light text-dark" style={{ fontSize: '0.65rem' }}>{status}</span>;
    };

    const attachments = submission?.attachments ? submission.attachments.split(" | ") : [];
    const files = attachments.filter((p: string) => p.startsWith("/uploads/"));
    const link = attachments.find((p: string) => p.startsWith("http"));

    return (
        <Modal show={show} onHide={onHide} centered backdrop="static" keyboard={false} size="lg">
            <Modal.Header closeButton style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1rem' }}>
                <Modal.Title className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>visibility</span>
                    Submission Details
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-3">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary me-2"></div>
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>Loading report details...</div>
                    </div>
                ) : submission ? (
                    <div className="view-mode">
                        <div className="mb-3">
                            <div className="d-flex align-items-center gap-2 mb-1">
                                <div className="fw-black text-dark" style={{ fontSize: '1.1rem' }}>{submission.report_name}</div>
                                {getStatusBadge(submission.status)}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {submission.submitted_at && `Submitted on ${formatDate(submission.submitted_at)}`}
                            </div>
                        </div>

                        <div className="p-3 rounded-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="fw-bold text-dark mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>subject</span>
                                Report Details
                            </div>
                            <p className="mb-0 text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {submission.description || 'No description provided.'}
                            </p>
                        </div>

                        {(link || files.length > 0) && (
                            <div className="d-flex flex-column gap-2 mb-3">
                                {link && (
                                    <div>
                                        <label className="fw-bold text-dark mb-1 small">Evidence Link</label>
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light border d-flex align-items-center gap-2 py-2 px-3 text-primary text-decoration-none" style={{ fontSize: '0.85rem', width: 'fit-content' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
                                            View Document/Link
                                        </a>
                                    </div>
                                )}

                                {files.length > 0 && (
                                    <div>
                                        <label className="fw-bold text-dark mb-1 small">Attached Documents</label>
                                        <div className="d-flex flex-wrap gap-2">
                                            {files.map((path: string, idx: number) => (
                                                <a key={idx} href={path} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-white border d-flex align-items-center gap-2 py-2 px-3 text-dark shadow-sm" style={{ fontSize: '0.8rem', borderRadius: '8px' }}>
                                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>download</span>
                                                    File {files.length > 1 ? idx + 1 : ''}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Evaluation Section */}
                        {(submission.status === 'Completed' || submission.status === 'Returned' || submission.status === 'Incomplete' || submission.status === 'Complete' || submission.status === 'Not Done') && (
                            <div className="evaluation-section mt-4 pt-3 border-top">
                                <div
                                    className="p-3 rounded-3"
                                    style={{
                                        background:
                                            submission.status === 'Completed' || submission.status === 'Complete'
                                                ? '#f0fdf4'
                                                : submission.status === 'Incomplete'
                                                  ? '#fffbeb'
                                                  : '#fff1f2',
                                        borderLeft: `4px solid ${
                                            submission.status === 'Completed' || submission.status === 'Complete'
                                                ? '#22c55e'
                                                : submission.status === 'Incomplete'
                                                  ? '#f59e0b'
                                                  : '#ef4444'
                                        }`,
                                    }}
                                >
                                    <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>feedback</span>
                                        Supervisor Evaluation
                                    </div>
                                    {(submission.evaluated_by_name || '').trim() ? (
                                        <div className="text-muted small mb-2" style={{ fontSize: '0.8rem' }}>
                                            <span className="fw-semibold text-dark">Evaluated by:</span>{' '}
                                            {String(submission.evaluated_by_name).trim()}
                                            {submission.evaluation_date
                                                ? ` · ${formatDate(submission.evaluation_date)}`
                                                : ''}
                                        </div>
                                    ) : null}
                                    <p className="mb-0 text-dark small" style={{ lineHeight: '1.4', fontStyle: 'italic' }}>
                                        {submission.reviewer_notes ? `"${submission.reviewer_notes}"` : 'No comments provided.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted">No submission found for this task.</div>
                )}
            </Modal.Body>
            <Modal.Footer className="border-0 bg-light p-3 d-flex justify-content-between flex-wrap gap-2">
                {(submission?.status === 'Returned' ||
                    submission?.status === 'Incomplete' ||
                    submission?.status === 'Under Review') ? (
                    <Button variant="warning" className="fw-bold shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '8px', color: '#854d0e' }}
                        onClick={() => {
                            if (onRevise) {
                                onRevise(submission);
                            } else {
                                const id = submission.process_subtask_id || submission.task_id || taskId;
                                window.location.href = `/staff?pg=tasks&taskId=${id}`;
                            }
                        }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                        {submission?.status === 'Under Review' ? 'Submit an update' : 'Resubmit'}
                    </Button>
                ) : <div></div>}

            </Modal.Footer>
        </Modal>
    );
}
