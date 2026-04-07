"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SubmissionDetailModal from '@/components/Staff/SubmissionDetailModal';
import TaskSubmissionModal from '@/components/Staff/TaskSubmissionModal';

interface SubmissionItem {
    id: number;
    task_id: number;
    activity_title: string;
    report_name: string;
    submitted_at: string;
    status: string;
    progress: number;
    description: string;
    reviewer_notes: string;
    task_description?: string;
    instruction?: string | null;
    start_date?: string;
    end_date?: string;
    evaluated_by_name?: string | null;
    evaluation_date?: string | null;
    assignment_type?: 'legacy' | 'process_task';
}

interface Stats {
    totalSubmitted: number;
    underReview: number;
    reviewed: number;
    returned: number;
    incomplete: number;
    totalEvaluations: number;
    completionRate: number;
}

export default function StaffSubmissions() {
    const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SubmissionItem | null>(null);
    const [showSubModal, setShowSubModal] = useState(false);
    const [filter, setFilter] = useState('All Status');

    const handleRevise = (s: SubmissionItem) => {
        // We keep selectedItem so TaskSubmissionModal can use it
        setShowSubModal(true);
    };

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
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

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        if (status === 'Under Review' || status === 'submitted') return <span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Under Review</span>;
        if (status === 'Completed' || status === 'evaluated' || status === 'Complete') return <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Complete</span>;
        if (status === 'Returned' || status === 'draft') return <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Returned</span>;
        if (status === 'Incomplete') return <span className="status-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Incomplete</span>;
        if (status === 'Not Done') return <span className="status-badge" style={{ background: '#f1f5f9', color: '#475569' }}>Not Done</span>;
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
            <SubmissionDetailModal 
                key={`view-${selectedItem?.id}`}
                show={!!selectedItem && !showSubModal} 
                onHide={() => setSelectedItem(null)} 
                submission={selectedItem}
                onRevise={handleRevise}
            />

            <TaskSubmissionModal 
                key={`edit-${selectedItem?.id}`}
                show={showSubModal}
                onHide={() => {
                    setShowSubModal(false);
                    setSelectedItem(null);
                }}
                task={selectedItem ? {
                    id: selectedItem.task_id,
                    title: selectedItem.report_name,
                    status: selectedItem.status,
                    instruction: selectedItem.instruction ?? null,
                    startDate: selectedItem.start_date,
                    dueDate: selectedItem.end_date,
                    assignment_type: selectedItem.assignment_type ?? 'legacy',
                } : null}
                onSuccess={() => {
                    setShowSubModal(false);
                    setSelectedItem(null);
                    fetchSubmissions();
                }}
            />

            {/* Performance summary banner (merged from Feedback page) */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#0f172a,var(--mubs-navy))', border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-5">
                        <div className="text-white-50 fw-bold" style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>Performance Summary</div>
                        <div className="fw-black text-white mt-2" style={{ fontSize: '1.8rem', lineHeight: '1.1' }}>Submissions & Evaluations</div>
                    </div>
                    <div className="col-12 col-md-7">
                        <div className="row g-3 text-center">
                            <div className="col-3">
                                <div className="fw-black text-white" style={{ fontSize: '1.4rem' }}>{stats.totalSubmitted}</div>
                                <div className="text-white-50" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Items Sent</div>
                            </div>
                            <div className="col-3">
                                <div className="fw-black text-white" style={{ fontSize: '1.4rem' }}>{stats.totalEvaluations}</div>
                                <div className="text-white-50" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Evaluated</div>
                            </div>
                            <div className="col-3">
                                <div className="fw-black" style={{ fontSize: '1.4rem', color: 'var(--mubs-yellow)' }}>{stats.completionRate}%</div>
                                <div className="text-white-50" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Success Rate</div>
                            </div>
                            <div className="col-3">
                                <div className="fw-black" style={{ fontSize: '1.4rem', color: stats.incomplete > 0 ? '#ef4444' : '#fff' }}>{stats.incomplete}</div>
                                <div className="text-white-50" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Incomplete</div>
                            </div>
                        </div>
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
                            <option value="Reviewed">Reviewed</option>
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
                                <th>Submitted Date</th>
                                <th>Status</th>
                                <th className="pe-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubmissions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-5 text-muted">
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
                                        <td style={{ fontSize: '.8rem', color: '#64748b' }}>{formatDate(item.submitted_at)}</td>
                                         <td>{getStatusBadge(item.status)}</td>
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
                                                    <button 
                                                        className="btn btn-sm btn-danger fw-bold px-3 shadow-sm d-flex align-items-center gap-1" 
                                                        style={{ borderRadius: '8px', fontSize: '.75rem' }}
                                                        onClick={() => {
                                                            setSelectedItem(item);
                                                            setShowSubModal(true);
                                                        }}
                                                        title="Revise and Resubmit"
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                                                        Resubmit
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
