'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface Submission {
    id: number;
    report_name: string;
    activity_title: string;
    staff_name: string;
    submitted_at: string;
    status: string;
    progress: number;
    score?: number;
    description?: string;
    reviewer_notes?: string;
}

interface SubmissionData {
    submissions: Submission[];
    stats: {
        pending: number;
        underReview: number;
        reviewed: number;
        returned: number;
    };
    recentActivity: Array<{
        id: number;
        type: string;
        message: string;
        date: string;
    }>;
}

export default function DepartmentSubmissions() {
    const router = useRouter();
    const [data, setData] = useState<SubmissionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('All Status');
    const [staffFilter, setStaffFilter] = useState('All Staff');
    const [selectedItem, setSelectedItem] = useState<Submission | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/department-head/submissions');
                setData(response.data);
            } catch (error: any) {
                console.error('Error fetching department submissions:', error);
                setError(error.response?.data?.message || 'Failed to load submissions. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Submissions</h5>
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

    const filteredSubmissions = data.submissions.filter(s => {
        const matchesStatus = statusFilter === 'All Status' || s.status === statusFilter || (statusFilter === 'Pending' && s.status === 'Under Review');
        const matchesStaff = staffFilter === 'All Staff' || s.staff_name === staffFilter;
        return matchesStatus && matchesStaff;
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        if (status === 'Pending') return <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending</span>;
        if (status === 'Under Review') return <span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Under Review</span>;
        if (status === 'Completed') return <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Reviewed</span>;
        if (status === 'Returned') return <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Returned</span>;
        return <span className="status-badge bg-light text-dark">{status}</span>;
    };

    const staffMembers = [...new Set(data.submissions.map(s => s.staff_name))].filter(Boolean);

    return (
        <div id="page-submissions" className="page-section active-page position-relative">
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
                                View Submission Details
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
                                        <div className="text-muted" style={{ fontSize: '.8rem', marginTop: '4px' }}>
                                            Submitted By: <strong>{selectedItem.staff_name}</strong> on {formatDate(selectedItem.submitted_at)}
                                        </div>
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
                            {selectedItem?.status === 'Pending' || selectedItem?.status === 'Under Review' ? (
                                <button type="button" className="btn btn-primary fw-bold shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '8px' }} onClick={() => {
                                    setSelectedItem(null);
                                    router.push('/department-head?pg=evaluations');
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rate_review</span>
                                    Evaluate Submission
                                </button>
                            ) : <div></div>}
                            <button type="button" className="btn btn-secondary fw-bold px-4" style={{ borderRadius: '8px' }} onClick={() => setSelectedItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="pending_actions"
                        label="Pending"
                        value={data.stats.pending}
                        badge="New"
                        badgeIcon="fiber_new"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="rate_review"
                        label="Under Review"
                        value={data.stats.underReview}
                        badge="Active"
                        badgeIcon="sync"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="task_alt"
                        label="Reviewed"
                        value={data.stats.reviewed}
                        badge="Complete"
                        badgeIcon="verified"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment_return"
                        label="Returned"
                        value={data.stats.returned}
                        badge="Action"
                        badgeIcon="reply"
                        color="red"
                    />
                </div>
            </div>

            <div className="row g-4">
                <div className="col-12 col-lg-8">
                    <div className="table-card shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">inbox</span>
                                All Submissions
                            </h5>
                            <div className="d-flex gap-2 flex-wrap ms-auto">
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: '140px' }}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option>All Status</option>
                                    <option>Pending</option>
                                    <option>Under Review</option>
                                    <option>Completed</option>
                                    <option>Returned</option>
                                </select>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: '140px' }}
                                    value={staffFilter}
                                    onChange={(e) => setStaffFilter(e.target.value)}
                                >
                                    <option>All Staff</option>
                                    {staffMembers.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4">Staff</th>
                                        <th>Report / Task</th>
                                        <th>Activity</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th className="pe-4 text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5 text-muted">No submissions found.</td>
                                        </tr>
                                    ) : (
                                        filteredSubmissions.map((s) => (
                                            <tr key={s.id}>
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
                                                            {s.staff_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </div>
                                                        <span className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{s.staff_name}</span>
                                                    </div>
                                                </td>
                                                <td className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{s.report_name}</td>
                                                <td style={{ fontSize: '.78rem', color: '#64748b' }}>{s.activity_title}</td>
                                                <td style={{ fontSize: '.78rem', color: '#64748b' }}>{formatDate(s.submitted_at)}</td>
                                                <td>
                                                    <span className="status-badge" style={{
                                                        background: s.status === 'Completed' ? '#dcfce7' : (s.status === 'Under Review' ? '#eff6ff' : (s.status === 'Returned' ? '#fee2e2' : '#fef9c3')),
                                                        color: s.status === 'Completed' ? '#15803d' : (s.status === 'Under Review' ? '#1d4ed8' : (s.status === 'Returned' ? '#b91c1c' : '#a16207')),
                                                        fontSize: '0.65rem'
                                                    }}>{s.status}</span>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    {s.status === 'Pending' || s.status === 'Under Review' ? (
                                                        <button
                                                            className="btn btn-sm btn-primary fw-bold py-1 px-3 d-inline-flex align-items-center gap-1 shadow-sm"
                                                            style={{ fontSize: '.74rem', borderRadius: '8px' }}
                                                            onClick={() => setSelectedItem(s)}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rate_review</span> View
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-sm btn-outline-secondary fw-bold py-1 px-3 d-inline-flex align-items-center gap-1 shadow-sm"
                                                            style={{ fontSize: '.74rem', borderRadius: '8px', background: '#fff' }}
                                                            onClick={() => setSelectedItem(s)}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span> View
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer border-top py-3 px-4">
                            <span className="footer-label small text-muted">Showing {filteredSubmissions.length} of {data.submissions.length} submissions</span>
                        </div>
                    </div>
                </div>

                {/* Submission timeline */}
                <div className="col-12 col-lg-4">
                    <div className="table-card shadow-sm border-0 h-100">
                        <div className="table-card-header bg-white border-bottom py-3">
                            <h5 className="mb-0 fw-black text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span>
                                Recent Activity
                            </h5>
                        </div>
                        <div className="p-4">
                            {data.recentActivity.length === 0 ? (
                                <div className="text-center py-4 text-muted small">No recent activity.</div>
                            ) : (
                                data.recentActivity.map((activity, idx) => (
                                    <div key={idx} className="timeline-item mb-4 pb-4 border-start ps-4 position-relative" style={{ borderLeftStyle: 'dashed' }}>
                                        <div className="timeline-dot position-absolute" style={{
                                            left: '-10px',
                                            top: '0',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: (activity.type === 'Completed' ? '#dcfce7' : (activity.type === 'Returned' ? '#fee2e2' : '#fef9c3')),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid white',
                                            boxShadow: '0 0 0 1px #e2e8f0'
                                        }}>
                                            <span className="material-symbols-outlined" style={{
                                                fontSize: '12px',
                                                color: (activity.type === 'Completed' ? '#15803d' : (activity.type === 'Returned' ? '#b91c1c' : '#a16207'))
                                            }}>
                                                {activity.type === 'Completed' ? 'check_circle' : (activity.type === 'Returned' ? 'reply' : 'inbox')}
                                            </span>
                                        </div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{activity.message}</div>
                                        <div className="text-muted small mt-1" style={{ fontSize: '.73rem' }}>{formatDate(activity.date)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
