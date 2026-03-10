"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CommDashboard() {
    const [approvalPct, setApprovalPct] = useState(0);

    useEffect(() => {
        // animate
        setTimeout(() => {
            setApprovalPct(75);
        }, 400);
    }, []);

    return (
        <div className="content-area-comm">
            {/* Hero banner */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg,#4c1d95 0%,var(--mubs-navy) 100%)', border: '1px solid rgba(167,139,250,.2)' }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="material-symbols-outlined" style={{ color: '#a78bfa', fontSize: '28px' }}>groups</span>
                            <div>
                                <div className="fw-black text-white" style={{ fontSize: '1.1rem' }}>Academic Board Committee</div>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex gap-4 text-center flex-wrap">
                        <div><div className="fw-black text-white" style={{ fontSize: '2rem', lineHeight: '1' }}>12</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total Proposals</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: '#10b981' }}>6</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Approved</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: 'var(--mubs-yellow)' }}>4</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pending</div></div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,.12)' }}></div>
                        <div><div className="fw-black" style={{ fontSize: '2rem', lineHeight: '1', color: '#f87171' }}>2</div><div style={{ fontSize: '.7rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em' }}>Rejected</div></div>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#7c3aed' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#f5f3ff' }}><span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>list_alt</span></div>
                            <span className="stat-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>This Year</span>
                        </div>
                        <div className="stat-label">Total Proposals</div>
                        <div className="stat-value">12</div>
                        <div className="stat-sub">Across 4 strategic pillars</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fffbeb' }}><span className="material-symbols-outlined" style={{ color: '#b45309' }}>pending_actions</span></div>
                            <span className="stat-badge" style={{ background: '#fffbeb', color: '#b45309' }}>Awaiting</span>
                        </div>
                        <div className="stat-label">Pending Review</div>
                        <div className="stat-value">4</div>
                        <div className="stat-sub">Sent to Admin &amp; Principal</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#ecfdf5' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
                            <span className="stat-badge" style={{ background: '#ecfdf5', color: '#059669' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>trending_up</span>+2</span>
                        </div>
                        <div className="stat-label">Approved</div>
                        <div className="stat-value">6</div>
                        <div className="stat-sub">Departments assigned &amp; active</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-red)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fff1f2' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>cancel</span></div>
                            <span className="stat-badge" style={{ background: '#fff1f2', color: 'var(--mubs-red)' }}>Review</span>
                        </div>
                        <div className="stat-label">Rejected</div>
                        <div className="stat-value">2</div>
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
                            <div className="proposal-card approved">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    <div className="activity-icon"><span className="material-symbols-outlined">science</span></div>
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <div className="proposal-title">Research Ethics Framework</div>
                                            <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>
                                        </div>
                                        <div className="proposal-meta">Proposed 03 Apr 2025 · Minutes: Meeting #7 · Assigned to: Research &amp; Innovation</div>
                                        <div className="mt-2 d-flex gap-2 flex-wrap">
                                            <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Evidence Attached</span>
                                            <span style={{ fontSize: '.73rem', background: '#ecfdf5', color: '#059669', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Department: Research &amp; Innovation</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-sm btn-outline-secondary fw-bold" style={{ fontSize: '.78rem' }}>View</button>
                                </div>
                            </div>

                            <div className="proposal-card pending">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    <div className="activity-icon"><span className="material-symbols-outlined">smart_toy</span></div>
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <div className="proposal-title">AI Integration Policy for Teaching</div>
                                            <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending Review</span>
                                        </div>
                                        <div className="proposal-meta">Proposed 10 Apr 2025 · Minutes: Meeting #8 · Awaiting Principal review</div>
                                        <div className="mt-2 d-flex gap-2 flex-wrap">
                                            <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Evidence Attached</span>
                                            <span style={{ fontSize: '.73rem', background: '#fef9c3', color: '#a16207', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Awaiting Approval</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-sm btn-outline-secondary fw-bold" style={{ fontSize: '.78rem' }}>View</button>
                                </div>
                            </div>

                            <div className="proposal-card rejected">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    <div className="activity-icon"><span className="material-symbols-outlined" style={{ color: '#e31837' }}>cancel</span></div>
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <div className="proposal-title">Third-Party Accreditation Programme</div>
                                            <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span>
                                        </div>
                                        <div className="proposal-meta">Proposed 01 Apr 2025 · Rejected 08 Apr 2025 · Reason provided</div>
                                        <div className="mt-2">
                                            <span style={{ fontSize: '.73rem', background: '#fee2e2', color: '#b91c1c', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}>Feedback Available</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-sm btn-outline-secondary fw-bold" style={{ fontSize: '.78rem' }}>View</button>
                                </div>
                            </div>

                            <div className="proposal-card pending">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    <div className="activity-icon"><span className="material-symbols-outlined">payments</span></div>
                                    <div className="flex-fill">
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <div className="proposal-title">Student Fee Restructuring 2025–26</div>
                                            <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending Review</span>
                                        </div>
                                        <div className="proposal-meta">Proposed 12 Apr 2025 · Minutes: Meeting #9 · Submitted to Admin</div>
                                    </div>
                                    <button className="btn btn-sm btn-outline-secondary fw-bold" style={{ fontSize: '.78rem' }}>View</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Approval funnel */}
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>analytics</span>Proposal Pipeline</h5></div>
                        <div className="p-4">
                            <div className="row g-3 text-center">
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#7c3aed' }}>12</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: '100%', background: '#7c3aed' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7c3aed', marginTop: '4px' }}>Submitted</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#b45309' }}>4</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: '33%', background: '#ffcd00' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>Under Review</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#059669' }}>6</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: '50%', background: '#10b981' }}></div></div>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>Approved</div>
                                </div>
                                <div className="col-3">
                                    <div className="fw-black" style={{ fontSize: '2rem', color: '#e31837' }}>2</div>
                                    <div className="progress-bar-custom mt-1"><div className="progress-bar-fill" style={{ width: '17%', background: '#e31837' }}></div></div>
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
                                        strokeDashoffset={approvalPct ? "85" : "339"}
                                        strokeLinecap="round" id="approvalArc"
                                        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                                    />
                                </svg>
                                <div className="perf-ring-label">
                                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a' }}>75%</div>
                                    <div style={{ fontSize: '.65rem', color: '#64748b', fontWeight: 700 }}>Approval Rate</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '.8rem', color: '#64748b' }}>6 approved out of 8 decided proposals</div>
                            <div className="d-flex justify-content-center gap-4 mt-3">
                                <div className="text-center"><div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>6</div><div style={{ fontSize: '.7rem', color: '#059669', fontWeight: 700 }}>Approved</div></div>
                                <div className="text-center"><div className="fw-black text-dark" style={{ fontSize: '1.2rem' }}>2</div><div style={{ fontSize: '.7rem', color: 'var(--mubs-red)', fontWeight: 700 }}>Rejected</div></div>
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
                                <span className="badge ms-auto" style={{ background: 'var(--mubs-yellow)', color: '#1e293b' }}>4</span>
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
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Research Ethics Framework approved</div>
                                <div className="text-muted" style={{ fontSize: '.73rem' }}>Assigned to Research &amp; Innovation · Today</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#fef9c3' }}><span className="material-symbols-outlined" style={{ color: '#b45309' }}>hourglass_top</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>AI Integration Policy under review</div>
                                <div className="text-muted" style={{ fontSize: '.73rem' }}>Awaiting Principal decision · 10 Apr</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#fee2e2' }}><span className="material-symbols-outlined" style={{ color: '#e31837' }}>cancel</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Third-Party Accreditation rejected</div>
                                <div className="text-muted" style={{ fontSize: '.73rem' }}>Feedback provided by Admin · 08 Apr</div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot" style={{ background: '#f5f3ff' }}><span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>post_add</span></div>
                                <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>New proposal submitted</div>
                                <div className="text-muted" style={{ fontSize: '.73rem' }}>Student Fee Restructuring · 12 Apr</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
