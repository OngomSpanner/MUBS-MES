'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import { linkify } from '@/lib/linkify';

interface PrincipalData {
    stats: {
        totalActivities: number;
        overallProgress: number;
        complianceRate: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
        totalUnits: number;
        riskAlerts: number;
        activeStaff: number;
    };
    complianceByUnit: Array<{ id: number; parent_id: number | null; unit_type: string | null; department: string; progress: number }>;
    riskAlerts: Array<{ id: number; title: string; department: string; daysPast?: number; daysLeft?: number; progress: number; status: string }>;
    overdueActivities: Array<{ id: number; title: string; department: string; daysOverdue: number; progress: number }>;
}

interface CommitteeProposal {
    id: number;
    title: string;
    status: string;
    committee_type?: string;
    department_name?: string;
    department_id?: number | null;
    date: string | null;
    description?: string | null;
    minute_reference?: string | null;
    budget?: number | null;
    submitted_by_name?: string | null;
}

export default function ExecutiveOverview() {
    const [data, setData] = useState<PrincipalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingProposals, setPendingProposals] = useState<CommitteeProposal[]>([]);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<CommitteeProposal | null>(null);
    const [reviewerNotes, setReviewerNotes] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState<'approve' | 'reject' | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/principal');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching principal dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                const res = await axios.get('/api/principal/committee-proposals');
                setPendingProposals(Array.isArray(res.data) ? res.data : []);
            } catch {
                setPendingProposals([]);
            }
        };
        fetchPending();
    }, []);

    const openReviewModal = (p: CommitteeProposal) => {
        setSelectedProposal(p);
        setReviewerNotes('');
        setReviewError(null);
        setReviewModalOpen(true);
    };

    const closeReviewModal = () => {
        setReviewModalOpen(false);
        setSelectedProposal(null);
        setReviewSubmitting(null);
        setReviewError(null);
    };

    const submitReview = async (action: 'Approved' | 'Rejected') => {
        if (!selectedProposal) return;
        setReviewError(null);
        setReviewSubmitting(action === 'Approved' ? 'approve' : 'reject');
        try {
            await axios.patch(`/api/principal/committee-proposals/${selectedProposal.id}`, {
                action,
                reviewer_notes: reviewerNotes.trim() || undefined
            });
            const res = await axios.get('/api/principal/committee-proposals');
            setPendingProposals(Array.isArray(res.data) ? res.data : []);
            closeReviewModal();
        } catch (err: any) {
            setReviewError(err?.response?.data?.message || 'Request failed. Please try again.');
        } finally {
            setReviewSubmitting(null);
        }
    };

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const { stats, complianceByUnit, riskAlerts, overdueActivities } = data;

    const safeStats = {
        totalActivities: Number(stats?.totalActivities ?? 0),
        overallProgress: Number(stats?.overallProgress ?? 0),
        complianceRate: Number(stats?.complianceRate ?? 0),
        onTrack: Number(stats?.onTrack ?? 0),
        inProgress: Number(stats?.inProgress ?? 0),
        delayed: Number(stats?.delayed ?? 0),
        totalUnits: Number(stats?.totalUnits ?? 0),
        riskAlerts: Number(stats?.riskAlerts ?? 0),
        activeStaff: Number(stats?.activeStaff ?? 0),
    };

    const complianceList: Array<{ id: number; parent_id: number | null; unit_type: string | null; department: string; progress: number }> = Array.isArray(complianceByUnit) ? complianceByUnit : [];
    const roots = complianceList.filter((u) => u.parent_id == null);
    const childrenByParentId: Record<number, typeof complianceList> = {};
    complianceList.forEach((u) => {
        if (u.parent_id != null) {
            if (!childrenByParentId[u.parent_id]) childrenByParentId[u.parent_id] = [];
            childrenByParentId[u.parent_id].push(u);
        }
    });

    return (
        <div id="page-overview" className="page-section active-page">
            {/* KPI Hero Banner */}
            <div className="kpi-hero mb-4">
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-auto text-center text-md-start">
                        <div className="kpi-hero-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span> Institutional Overview · Strategic Plan 2025-2030
                        </div>
                        <div className="d-flex align-items-end gap-3 flex-wrap justify-content-center justify-content-md-start">
                            <div>
                                <div className="kpi-hero-value">{safeStats.overallProgress}<span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span></div>
                                <div className="kpi-hero-label">Overall Strategic Progress</div>
                                <div className="progress mt-2" style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                    <div className="progress-bar" style={{
                                        width: `${safeStats.overallProgress}%`,
                                        background: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                                        boxShadow: '0 0 10px rgba(96, 165, 250, 0.5)'
                                    }}></div>
                                </div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block"></div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{safeStats.totalActivities}</div>
                                <div className="kpi-hero-label">Total Activities</div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block"></div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{safeStats.complianceRate}<span style={{ fontSize: '1.2rem' }}>%</span></div>
                                <div className="kpi-hero-label">Compliance Rate</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md ms-md-auto">
                        <div className="row g-3 text-white">
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80' }}>{safeStats.onTrack}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '.08em' }}>On Track</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{safeStats.inProgress}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '.08em' }}>In Progress</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fca5a5' }}>{safeStats.delayed}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '.08em' }}>Delayed</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c4b5fd' }}>{safeStats.totalUnits}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.08em' }}>Departments</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="verified_user"
                        label="Compliance Rate"
                        value={`${safeStats.complianceRate}%`}
                        badge="Live"
                        badgeIcon="check_circle"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="running_with_errors"
                        label="Delayed Activities"
                        value={safeStats.delayed}
                        badge={safeStats.delayed > 0 ? "Needs Attention" : "Clear"}
                        badgeIcon={safeStats.delayed > 0 ? "warning" : "check"}
                        color="red"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="crisis_alert"
                        label="Risk Alerts"
                        value={safeStats.riskAlerts}
                        badge="Active"
                        badgeIcon="notifications_active"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="groups"
                        label="Active Staff"
                        value={safeStats.activeStaff}
                        badge="Staff"
                        badgeIcon="person"
                        color="blue"
                    />
                </div>
            </div>

            {pendingProposals.length > 0 && (
                <div className="table-card mb-4" style={{ borderLeft: '4px solid #7c3aed' }}>
                    <div className="table-card-header">
                        <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>gavel</span>Committee proposals pending your review</h5>
                        <Link href="/comm?pg=pending" className="btn btn-sm fw-bold text-white" style={{ background: '#7c3aed' }}>Review all</Link>
                    </div>
                    <div className="p-3">
                        <p className="text-muted small mb-2">Proposals from the committee (Academic Board, TMC, Council) awaiting Principal approval.</p>
                        <ul className="list-group list-group-flush">
                            {pendingProposals.slice(0, 5).map((p) => (
                                <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                                    <div>
                                        <span className="fw-bold text-dark">{p.title}</span>
                                        {p.committee_type && <span className="badge bg-light text-dark ms-2">{p.committee_type}</span>}
                                        {p.department_name && <span className="text-muted small ms-2">· {p.department_name}</span>}
                                    </div>
                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openReviewModal(p)}>Review</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {/* Risk Alerts Panel */}
                <div className="col-12 col-lg-5">
                    <div className="table-card h-100">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>crisis_alert</span>Active Risk Alerts</h5>
                            <span className="badge" style={{ background: 'var(--mubs-red)', fontSize: '.72rem' }}>{riskAlerts.length} Open</span>
                        </div>
                        <div className="p-3">
                            {riskAlerts.length > 0 ? riskAlerts.map((risk, index) => (
                                <div key={index} className="risk-item" style={{
                                    background: risk.status === 'Critical' ? '#fff1f2' : '#fffbeb',
                                    borderLeft: `4px solid ${risk.status === 'Critical' ? '#e31837' : '#ffcd00'}`,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    <div className="risk-dot" style={{ background: risk.status === 'Critical' ? '#e31837' : '#ffcd00', width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                    <div className="flex-fill overflow-hidden">
                                        <div className="risk-title text-dark fw-bold" style={{ fontSize: '.85rem' }}>{risk.title}</div>
                                        <div className="risk-meta text-muted" style={{ fontSize: '.72rem' }}>
                                            {risk.department} · {risk.daysPast ? `${risk.daysPast} days overdue` : `${risk.daysLeft} days left`} · {risk.progress}% complete
                                        </div>
                                        <span className="status-badge mt-1" style={{
                                            background: risk.status === 'Critical' ? '#fee2e2' : '#fef9c3',
                                            color: risk.status === 'Critical' ? '#b91c1c' : '#a16207',
                                            fontSize: '.62rem',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        }}>{risk.status}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center p-4 text-muted border border-dashed rounded">No active risk alerts.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Compliance & Institutional health */}
                <div className="col-12 col-lg-7">
                    <div className="table-card mb-4">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>fact_check</span>Compliance by Department</h5>
                        </div>
                        <div className="p-4">
                            {roots.map((root) => {
                                const children = childrenByParentId[root.id] ?? [];
                                return (
                                    <div key={root.id} className="mb-4">
                                        <div className="d-flex align-items-center gap-2 mb-2" style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '20px' }}>account_balance</span>
                                            <span className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>{root.department}</span>
                                            <span className="text-muted small">({children.length} department{children.length !== 1 ? 's' : ''} / unit{children.length !== 1 ? 's' : ''})</span>
                                        </div>
                                        {children.length === 0 ? (
                                            <div className="text-muted small ps-4 pb-2">No departments or units under this faculty/office.</div>
                                        ) : (
                                            <div className="ps-4 d-flex flex-column gap-2">
                                                {children.map((unit) => (
                                                    <div key={unit.id} className="compare-bar-wrap">
                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                            <span className="compare-bar-label fw-bold" style={{ fontSize: '.8rem' }}>{unit.department}</span>
                                                            <span className="compare-bar-pct fw-bold text-dark" style={{ fontSize: '.83rem' }}>{unit.progress}%</span>
                                                        </div>
                                                        <div className="progress" style={{ height: '8px', borderRadius: '4px', background: '#e2e8f0' }}>
                                                            <div className="progress-bar" style={{
                                                                width: `${Math.min(100, unit.progress)}%`,
                                                                background: unit.progress >= 75 ? '#10b981' : (unit.progress >= 50 ? '#ffcd00' : '#e31837'),
                                                                borderRadius: '4px'
                                                            }}></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {roots.length === 0 && (
                                <div className="text-muted text-center py-3">No faculty or office data available.</div>
                            )}
                            <div className="mt-3 pt-3 border-top d-flex gap-3 flex-wrap">
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>≥75% — Compliant</span></div>
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ffcd00' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>50–74% — Watch</span></div>
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e31837' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>&lt;50% — Critical</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Quick delayed table */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>schedule</span>Overdue Activities</h5>
                            <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>{overdueActivities.length} Overdue</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead><tr><th style={{ fontSize: '.75rem' }}>Activity</th><th style={{ fontSize: '.75rem' }}>Department</th><th style={{ fontSize: '.75rem' }}>Days Overdue</th><th style={{ fontSize: '.75rem' }}>Progress</th></tr></thead>
                                <tbody>
                                    {overdueActivities.length > 0 ? overdueActivities.map((act, index) => (
                                        <tr key={index}>
                                            <td className="fw-bold text-dark text-truncate" style={{ fontSize: '.83rem', maxWidth: '200px' }}>{act.title}</td>
                                            <td style={{ fontSize: '.8rem' }}>{act.department}</td>
                                            <td><span className="badge bg-danger">+{act.daysOverdue}</span></td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="progress flex-fill" style={{ height: '6px', width: '60px', borderRadius: '3px', background: '#f1f5f9' }}>
                                                        <div className="progress-bar" style={{ width: `${act.progress}%`, background: '#e31837' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '.73rem', fontWeight: 700, color: '#64748b' }}>{act.progress}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="text-center p-3 text-muted">No overdue activities found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Committee proposal review modal */}
            {reviewModalOpen && selectedProposal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>gavel</span>
                                    Review committee proposal
                                </h5>
                                <button type="button" className="btn-close" onClick={closeReviewModal} aria-label="Close" disabled={!!reviewSubmitting} />
                            </div>
                            <div className="modal-body pt-2">
                                <div className="mb-3">
                                    <span className="text-muted small d-block">Title</span>
                                    <span className="fw-bold text-dark">{selectedProposal.title}</span>
                                </div>
                                <div className="d-flex flex-wrap gap-3 mb-3">
                                    {selectedProposal.committee_type && (
                                        <div>
                                            <span className="text-muted small d-block">Committee</span>
                                            <span className="badge bg-light text-dark">{selectedProposal.committee_type}</span>
                                        </div>
                                    )}
                                    {selectedProposal.department_name && (
                                        <div>
                                            <span className="text-muted small d-block">Department</span>
                                            <span className="text-dark">{selectedProposal.department_name}</span>
                                        </div>
                                    )}
                                    {selectedProposal.submitted_by_name && (
                                        <div>
                                            <span className="text-muted small d-block">Submitted by</span>
                                            <span className="text-dark">{selectedProposal.submitted_by_name}</span>
                                        </div>
                                    )}
                                    {selectedProposal.date && (
                                        <div>
                                            <span className="text-muted small d-block">Date</span>
                                            <span className="text-dark">{selectedProposal.date}</span>
                                        </div>
                                    )}
                                </div>
                                {selectedProposal.description && (
                                    <div className="mb-3">
                                        <span className="text-muted small d-block">Description</span>
                                        <div className="mb-0 text-dark" style={{ fontSize: '.9rem', wordBreak: 'break-word' }}>{linkify(selectedProposal.description)}</div>
                                    </div>
                                )}
                                {(selectedProposal.minute_reference || (selectedProposal.budget != null && selectedProposal.budget !== 0)) && (
                                    <div className="d-flex flex-wrap gap-3 mb-3">
                                        {selectedProposal.minute_reference && (
                                            <div style={{ wordBreak: 'break-word' }}>
                                                <span className="text-muted small d-block">Minute reference</span>
                                                <span className="text-dark">{linkify(selectedProposal.minute_reference)}</span>
                                            </div>
                                        )}
                                        {selectedProposal.budget != null && selectedProposal.budget !== 0 && (
                                            <div>
                                                <span className="text-muted small d-block">Budget</span>
                                                <span className="text-dark">{Number(selectedProposal.budget).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="mb-3">
                                    <label className="form-label text-muted small">Reviewer notes (optional)</label>
                                    <textarea
                                        className="form-control"
                                        rows={2}
                                        placeholder="Add notes for the committee or for records..."
                                        value={reviewerNotes}
                                        onChange={(e) => setReviewerNotes(e.target.value)}
                                        disabled={!!reviewSubmitting}
                                    />
                                </div>
                                {reviewError && (
                                    <div className="alert alert-danger py-2 mb-3" role="alert">{reviewError}</div>
                                )}
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeReviewModal} disabled={!!reviewSubmitting}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => submitReview('Rejected')}
                                    disabled={!!reviewSubmitting}
                                >
                                    {reviewSubmitting === 'reject' ? 'Rejecting…' : 'Reject'}
                                </button>
                                <button
                                    type="button"
                                    className="btn text-white"
                                    style={{ background: '#7c3aed' }}
                                    onClick={() => submitReview('Approved')}
                                    disabled={!!reviewSubmitting}
                                >
                                    {reviewSubmitting === 'approve' ? 'Approving…' : 'Approve & add to strategic activities'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
