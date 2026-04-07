"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface ProposalItem {
    id: number;
    title: string;
    status: string;
    date: string | null;
    meta: string;
    committee_type?: string;
    department_name?: string;
}

interface CommitteeStats {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
}

interface ActivityItem {
    description: string;
    timestamp: string;
    detail?: string;
    icon: string;
    bgColor: string;
    iconColor: string;
}

export default function CommDashboard() {
    const [approvalPct, setApprovalPct] = useState(0);
    const [stats, setStats] = useState<CommitteeStats | null>(null);
    const [proposals, setProposals] = useState<ProposalItem[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [committees, setCommittees] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('/api/dashboard/committee');
                setStats(res.data.stats || { total: 0, approved: 0, pending: 0, rejected: 0 });
                setProposals(Array.isArray(res.data.proposals) ? res.data.proposals : []);
                setActivity(Array.isArray(res.data.activity) ? res.data.activity : []);
                setCommittees(Array.isArray(res.data.committees) ? res.data.committees : []);
                const total = Number(res.data.stats?.total) || 0;
                const approved = Number(res.data.stats?.approved) || 0;
                const rejected = Number(res.data.stats?.rejected) || 0;
                const decided = approved + rejected;
                setApprovalPct(decided ? Math.round((approved / decided) * 100) : 0);
            } catch (e: any) {
                if (e?.response?.status === 401) window.location.href = '/';
                else console.error('Committee dashboard fetch error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const total = stats?.total ?? 0;
    const approved = stats?.approved ?? 0;
    const pending = stats?.pending ?? 0;
    const rejected = stats?.rejected ?? 0;

    const statusStyle = (status: string) => {
        if (status === 'Approved') return { background: '#dcfce7', color: '#15803d' };
        if (status === 'Pending' || status === 'Edit Requested') return { background: '#fef9c3', color: '#a16207' };
        if (status === 'Rejected') return { background: '#fee2e2', color: '#b91c1c' };
        return { background: '#f1f5f9', color: '#475569' };
    };

    return (
        <div className="content-area-comm">
            {/* Hero banner */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#4c1d95 0%,var(--mubs-navy) 100%)', border: '1px solid rgba(167,139,250,.2)' }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="material-symbols-outlined" style={{ color: '#a78bfa', fontSize: '28px' }}>groups</span>
                            <div>
                                <div className="fw-black text-white" style={{ fontSize: '1.1rem' }}>
                                    {committees.length > 0
                                        ? (committees.length === 1 ? committees[0] : 'My committees')
                                        : 'Committee'}
                                </div>
                                <div style={{ fontSize: '.75rem', color: '#c4b5fd' }}>
                                    {committees.length > 0
                                        ? committees.length === 1
                                            ? 'Viewing proposals for your committee'
                                            : `Viewing: ${committees.join(', ')}`
                                        : 'Viewing all committee proposals'}
                                </div>
                            </div>
                        </div>
                    </div>
                    {!loading && (
                    <div className="d-flex gap-4 text-center flex-wrap">
                        <div><div className="fw-black text-white" style={{ fontSize: '2rem', lineHeight: '1' }}>{total}</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total Proposals</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: '#10b981' }}>{approved}</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Approved</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: 'var(--mubs-yellow)' }}>{pending}</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pending</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: '#f87171' }}>{rejected}</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Rejected</div></div>
                    </div>
                    )}
                </div>
            </div>

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#7c3aed' }}>
                        <div className="stat-label">Total Proposals</div>
                        <div className="stat-value">{loading ? '…' : total}</div>
                        <div className="stat-sub">Across committees</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="stat-label">Pending Review</div>
                        <div className="stat-value">{loading ? '…' : pending}</div>
                        <div className="stat-sub">Sent to Admin &amp; Principal</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="stat-label">Approved</div>
                        <div className="stat-value">{loading ? '…' : approved}</div>
                        <div className="stat-sub">Departments assigned &amp; active</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-red)' }}>
                        <div className="stat-label">Rejected</div>
                        <div className="stat-value">{loading ? '…' : rejected}</div>
                        <div className="stat-sub">Feedback provided</div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Recent proposals */}
                <div className="col-12 col-lg-8">
                    <div className="table-card mb-4">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>list_alt</span>Recent Proposals</h5>
                            <Link href="/comm?pg=my-proposals" className="btn btn-sm btn-outline-secondary">View All</Link>
                        </div>
                        <div className="p-3 d-flex flex-column gap-0">
                            {loading ? (
                                <div className="p-4 text-center text-muted">Loading…</div>
                            ) : proposals.length === 0 ? (
                                <div className="p-4 text-center text-muted">No proposals yet.</div>
                            ) : (
                                proposals.slice(0, 5).map((p) => (
                                    <div key={p.id} className={`proposal-card ${p.status === 'Approved' ? 'approved' : p.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                        <div className="d-flex align-items-start gap-3 flex-wrap">
                                            <div className="activity-icon"><span className="material-symbols-outlined">description</span></div>
                                            <div className="flex-fill">
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <div className="proposal-title">{p.title}</div>
                                                    <span className="status-badge" style={statusStyle(p.status)}>{p.status}</span>
                                                </div>
                                                <div className="proposal-meta">{p.date ? `Proposed ${p.date}` : ''}{p.meta ? ` · ${String(p.meta).slice(0, 60)}${String(p.meta).length > 60 ? '…' : ''}` : ''}</div>
                                                {p.department_name && <div className="mt-2"><span style={{ fontSize: '.73rem', background: '#ecfdf5', color: '#059669', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Department: {p.department_name}</span></div>}
                                            </div>
                                            <Link
                                                href={p.status === 'Approved' ? '/comm?pg=approved' : p.status === 'Rejected' ? '/comm?pg=rejected' : `/comm?pg=pending&id=${p.id}`}
                                                className="btn btn-sm btn-outline-secondary fw-bold"
                                                style={{ fontSize: '.78rem' }}
                                            >
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Approval funnel */}
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>analytics</span>Proposal Pipeline</h5></div>
                        <div className="p-4">
                            <div className="row g-3 text-center">
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#7c3aed' }}>{loading ? '…' : total}</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: total ? '100%' : '0%', background: '#7c3aed' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7c3aed', marginTop: '4px' }}>Submitted</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#b45309' }}>{loading ? '…' : pending}</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: total ? `${(pending / total) * 100}%` : '0%', background: '#ffcd00' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>Under Review</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#059669' }}>{loading ? '…' : approved}</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: total ? `${(approved / total) * 100}%` : '0%', background: '#10b981' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>Approved</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#e31837' }}>{loading ? '…' : rejected}</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: total ? `${(rejected / total) * 100}%` : '0%', background: '#e31837' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#e31837', marginTop: '4px' }}>Rejected</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="col-12 col-lg-4 d-flex flex-column gap-4">

                    {/* Approval rate ring */}
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>donut_large</span>Approval Rate</h5></div>
                        <div className="p-4 text-center">
                            <div className="perf-ring mb-2" style={{ display: 'inline-flex' }}>
                                <svg width="130" height="130" viewBox="0 0 130 130">
                                    <circle cx="65" cy="65" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                                    <circle
                                        cx="65" cy="65" r="54" fill="none" stroke="#7c3aed" strokeWidth="12"
                                        strokeDasharray="339"
                                        strokeDashoffset={approvalPct ? String(339 - (approvalPct / 100) * 339) : "339"}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                                    />
                                </svg>
                                <div className="perf-ring-label">
                                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a' }}>{loading ? '…' : `${approvalPct}%`}</div>
                                    <div style={{ fontSize: '.65rem', color: '#64748b', fontWeight: 700 }}>Approval Rate</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '.8rem', color: '#64748b' }}>{approved} approved out of {approved + rejected || 0} decided proposals</div>
                            <div className="d-flex justify-content-center gap-4 mt-3">
                                <div className="text-center"><div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>{approved}</div><div style={{ fontSize: '.7rem', color: '#059669', fontWeight: 700 }}>Approved</div></div>
                                <div className="text-center"><div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>{rejected}</div><div style={{ fontSize: '.7rem', color: 'var(--mubs-red)', fontWeight: 700 }}>Rejected</div></div>
                            </div>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>bolt</span>Quick Actions</h5></div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <Link href="/comm?pg=propose" className="btn fw-bold text-start d-flex align-items-center gap-2" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>post_add</span> New Proposal from Minutes
                            </Link>
                            <Link href="/comm?pg=pending" className="btn btn-outline-warning fw-bold text-start d-flex align-items-center gap-2 text-dark">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>pending_actions</span> Check Pending Proposals
                                {!loading && pending > 0 && <span className="badge ms-auto" style={{ background: 'var(--mubs-yellow)', color: '#1e293b' }}>{pending}</span>}
                            </Link>
                            <Link href="/comm?pg=approved" className="btn btn-outline-success fw-bold text-start d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>check_circle</span> View Approved Activities
                            </Link>
                            <Link href="/comm?pg=rejected" className="btn btn-outline-secondary fw-bold text-start d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span> Review Rejected Proposals
                            </Link>
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>history</span>Recent Activity</h5></div>
                        <div className="p-4">
                            {loading ? (
                                <div className="text-center text-muted small">Loading…</div>
                            ) : activity.length === 0 ? (
                                <div className="text-center text-muted small">No recent activity.</div>
                            ) : (
                                activity.map((act, index) => (
                                    <div key={index} className={`timeline-item ${index > 0 ? 'mt-3' : ''}`}>
                                        <div className="timeline-dot" style={{ background: act.bgColor }}><span className="material-symbols-outlined" style={{ color: act.iconColor, fontSize: '18px' }}>{act.icon}</span></div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{act.description}</div>
                                        <div className="text-muted" style={{ fontSize: '.73rem' }}>{act.detail || act.timestamp}</div>
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
