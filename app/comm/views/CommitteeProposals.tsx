"use client";

import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function CommitteeProposals({ status }: { status: string }) {
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('approved');

    const handleOpenModal = (type: string) => {
        setModalType(type);
        setShowModal(true);
    };

    const renderContent = () => {
        if (status === 'my-proposals') {
            return (
                <div id="page-my-proposals" className="page-section active-page">
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: '#7c3aed', padding: '.9rem' }}><div className="stat-value" style={{ fontSize: '1.8rem', color: '#7c3aed' }}>12</div><div className="stat-label">Total</div></div></div>
                        <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-yellow)', padding: '.9rem' }}><div className="stat-value" style={{ fontSize: '1.8rem', color: '#b45309' }}>4</div><div className="stat-label">Pending</div></div></div>
                        <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: '#10b981', padding: '.9rem' }}><div className="stat-value" style={{ fontSize: '1.8rem', color: '#059669' }}>6</div><div className="stat-label">Approved</div></div></div>
                        <div className="col-6 col-sm-3"><div className="stat-card text-center" style={{ borderLeftColor: 'var(--mubs-red)', padding: '.9rem' }}><div className="stat-value" style={{ fontSize: '1.8rem', color: 'var(--mubs-red)' }}>2</div><div className="stat-label">Rejected</div></div></div>
                    </div>

                    <div className="table-card" style={{ borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
                        <div className="table-card-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
                            <h5 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>list_alt</span>All Committee Proposals</h5>
                            <div className="d-flex gap-2 flex-wrap">
                                <div className="input-group input-group-sm" style={{ width: '200px' }}>
                                    <span className="input-group-text bg-white"><span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#64748b' }}>search</span></span>
                                    <input type="text" className="form-control" placeholder="Search proposals..." />
                                </div>
                                <select className="form-select form-select-sm" style={{ width: '140px' }}><option>All Status</option><option>Pending</option><option>Approved</option><option>Rejected</option></select>
                                <select className="form-select form-select-sm" style={{ width: '160px' }}><option>All Pillars</option><option>Teaching &amp; Learning</option><option>Research &amp; Innovation</option><option>Infrastructure</option><option>Governance</option></select>
                                <a href="/committee?pg=propose" className="btn btn-sm fw-bold text-white d-flex align-items-center" style={{ background: '#7c3aed' }}>
                                    <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>add</span>New Proposal
                                </a>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead><tr style={{ background: '#f8fafc' }}><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Proposal</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Pillar</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Meeting Ref.</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Submitted</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Status</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Assigned Department</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Evidence</th><th style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mubs-blue)' }}>Actions</th></tr></thead>
                                <tbody>
                                    <tr><td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Research Ethics Framework</div><div className="text-muted" style={{ fontSize: '.72rem' }}>Priority: High</div></td><td><span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '.62rem' }}>Research</span></td><td style={{ fontSize: '.8rem' }}>Meeting #7</td><td style={{ fontSize: '.8rem', color: '#64748b' }}>03 Apr</td><td><span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span></td><td style={{ fontSize: '.82rem', fontWeight: 700, color: '#059669' }}>Research &amp; Innovation</td><td><button className="btn btn-xs btn-outline-secondary py-0 px-1" style={{ fontSize: '.72rem' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span></button></td><td><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.74rem' }} onClick={() => handleOpenModal('approved')}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>visibility</span></button></td></tr>
                                    {/* Additional rows omitted for brevity, mapping the same pattern */}
                                    <tr style={{ background: '#fffbeb' }}><td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>AI Integration Policy for Teaching</div><div className="text-muted" style={{ fontSize: '.72rem' }}>Priority: High</div></td><td><span className="status-badge" style={{ background: '#fdf2f8', color: '#9333ea', fontSize: '.62rem' }}>Teaching</span></td><td style={{ fontSize: '.8rem' }}>Meeting #8</td><td style={{ fontSize: '.8rem', color: '#64748b' }}>10 Apr</td><td><span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending</span></td><td style={{ fontSize: '.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Awaiting approval</td><td><button className="btn btn-xs btn-outline-secondary py-0 px-1" style={{ fontSize: '.72rem' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span></button></td><td><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.74rem' }} onClick={() => handleOpenModal('pending')}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>visibility</span></button></td></tr>
                                    <tr style={{ background: '#fff9f9' }}><td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Third-Party Accreditation Programme</div><div className="text-muted" style={{ fontSize: '.72rem' }}>Priority: High</div></td><td><span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '.62rem' }}>Governance</span></td><td style={{ fontSize: '.8rem' }}>Meeting #7</td><td style={{ fontSize: '.8rem', color: '#64748b' }}>01 Apr</td><td><span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span></td><td style={{ fontSize: '.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Not assigned</td><td><button className="btn btn-xs btn-outline-secondary py-0 px-1" style={{ fontSize: '.72rem' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span></button></td><td><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.74rem' }} onClick={() => handleOpenModal('rejected')}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>visibility</span></button></td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer" style={{ padding: '.9rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="footer-label" style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#94a3b8' }}>Showing 3 of 12 proposals</span>
                            <div className="d-flex gap-1">
                                <button className="page-btn active" style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'var(--mubs-blue)', color: '#fff' }}>1</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (status === 'pending') {
            return (
                <div id="page-pending" className="page-section active-page">
                    <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '5px solid var(--mubs-yellow)', borderRadius: '10px', color: '#713f12' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>hourglass_top</span>
                        <div><strong>4 proposals</strong> are currently awaiting review. Once the Principal makes a decision, you will be notified by email and in-system.</div>
                    </div>

                    <div className="d-flex flex-column gap-0">
                        {/* Pending 1 */}
                        <div className="proposal-card pending">
                            <div className="d-flex align-items-start gap-3 flex-wrap">
                                <div className="activity-icon"><span className="material-symbols-outlined">smart_toy</span></div>
                                <div className="flex-fill">
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                        <div className="proposal-title">AI Integration Policy for Teaching</div>
                                        <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending — Principal Review</span>
                                    </div>
                                    <div className="proposal-meta">Meeting #8 · Proposed 10 Apr 2025 · Pillar: Teaching &amp; Learning · Priority: High</div>
                                    <div className="stepper mt-3 mb-2" style={{ maxWidth: '420px' }}>
                                        <div className="step done"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></div><div className="step-label">Submitted</div></div>
                                        <div className="step done"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></div><div className="step-label">Admin</div></div>
                                        <div className="step active-step"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>gavel</span></div><div className="step-label">Principal</div></div>
                                        <div className="step"><div className="step-dot">4</div><div className="step-label">Decision</div></div>
                                    </div>
                                    <div className="d-flex align-items-center gap-2 mt-1">
                                        <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span> Minutes attached</span>
                                        <span style={{ fontSize: '.73rem', background: '#eff6ff', color: 'var(--mubs-blue)', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>link</span> Evidence linked</span>
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => handleOpenModal('pending')}>View Details</button>
                            </div>
                        </div>

                        {/* Pending 2 */}
                        <div className="proposal-card pending mt-3">
                            <div className="d-flex align-items-start gap-3 flex-wrap">
                                <div className="activity-icon"><span className="material-symbols-outlined">payments</span></div>
                                <div className="flex-fill">
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                        <div className="proposal-title">Student Fee Restructuring 2025–26</div>
                                        <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending — Admin Review</span>
                                    </div>
                                    <div className="proposal-meta">Meeting #9 · Proposed 12 Apr 2025 · Pillar: Finance &amp; Resources · Priority: High</div>
                                    <div className="stepper mt-3 mb-2" style={{ maxWidth: '420px' }}>
                                        <div className="step done"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></div><div className="step-label">Submitted</div></div>
                                        <div className="step active-step"><div className="step-dot"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>manage_accounts</span></div><div className="step-label">Admin</div></div>
                                        <div className="step"><div className="step-dot">3</div><div className="step-label">Principal</div></div>
                                        <div className="step"><div className="step-dot">4</div><div className="step-label">Decision</div></div>
                                    </div>
                                    <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span> Minutes attached</span>
                                </div>
                                <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => handleOpenModal('pending')}>View Details</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (status === 'approved') {
            return (
                <div id="page-approved" className="page-section active-page">
                    <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '5px solid #10b981', borderRadius: '10px', color: '#14532d' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>info</span>
                        <div>These proposals have been <strong>approved</strong> by the Principal and assigned to implementing departments. Department assignments and progress are shown below as <strong>read-only</strong>.</div>
                    </div>

                    <div className="d-flex flex-column gap-0">
                        {/* Approved 1 */}
                        <div className="proposal-card approved">
                            <div className="d-flex align-items-start gap-3 flex-wrap">
                                <div className="activity-icon" style={{ background: 'rgba(16,185,129,.08)', borderColor: 'rgba(16,185,129,.15)' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>science</span></div>
                                <div className="flex-fill">
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                        <div className="proposal-title">Research Ethics Framework</div>
                                        <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>
                                    </div>
                                    <div className="proposal-meta">Meeting #7 · Approved 08 Apr 2025 · Approved by: Principal Prof. R. Wamala</div>
                                    <div className="department-assign-card mt-3">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>assignment_ind</span>
                                            <span className="fw-black text-dark" style={{ fontSize: '.85rem' }}>Assigned Implementation Department</span>
                                            <span className="read-only-badge ms-auto">Read Only</span>
                                        </div>
                                        <div className="row g-2">
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Department</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Research &amp; Innovation</div></div>
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>HOD</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Dr. M. Kizito</div></div>
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Target Deadline</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>31 Dec 2025</div></div>
                                        </div>
                                        <div className="mt-2"><div className="text-muted mb-1" style={{ fontSize: '.72rem', fontWeight: 700 }}>Implementation Progress</div><div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: '29%', background: '#10b981' }}></div></div><span style={{ fontSize: '.72rem', color: '#64748b' }}>29% · In Progress</span></div>
                                    </div>
                                    <div className="d-flex gap-2 mt-2 flex-wrap">
                                        <span style={{ fontSize: '.73rem', background: '#f5f3ff', color: '#6d28d9', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span> Minutes: Meeting #7</span>
                                        <span style={{ fontSize: '.73rem', background: '#eff6ff', color: 'var(--mubs-blue)', padding: '.18rem .55rem', borderRadius: '99px', fontWeight: 700 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>link</span> Evidence attached</span>
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-outline-success fw-bold" onClick={() => handleOpenModal('approved')}>View</button>
                            </div>
                        </div>

                        {/* Approved 2 */}
                        <div className="proposal-card approved mt-3">
                            <div className="d-flex align-items-start gap-3 flex-wrap">
                                <div className="activity-icon" style={{ background: 'rgba(16,185,129,.08)', borderColor: 'rgba(16,185,129,.15)' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>computer</span></div>
                                <div className="flex-fill">
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                        <div className="proposal-title">Digital Literacy for Staff</div>
                                        <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>
                                    </div>
                                    <div className="proposal-meta">Meeting #6 · Approved 02 Apr 2025 · Approved by: Principal Prof. R. Wamala</div>
                                    <div className="department-assign-card mt-3">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>assignment_ind</span>
                                            <span className="fw-black text-dark" style={{ fontSize: '.85rem' }}>Assigned Implementation Department</span>
                                            <span className="read-only-badge ms-auto">Read Only</span>
                                        </div>
                                        <div className="row g-2">
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Department</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Faculty of Computing</div></div>
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>HOD</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Dr. A. Ssekandi</div></div>
                                            <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Target Deadline</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>30 Sep 2025</div></div>
                                        </div>
                                        <div className="mt-2"><div className="text-muted mb-1" style={{ fontSize: '.72rem', fontWeight: 700 }}>Implementation Progress</div><div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: '54%', background: '#10b981' }}></div></div><span style={{ fontSize: '.72rem', color: '#64748b' }}>54% · On Track</span></div>
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-outline-success fw-bold" onClick={() => handleOpenModal('approved')}>View</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (status === 'rejected') {
            return (
                <div id="page-rejected" className="page-section active-page">
                    <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: '#fff1f2', border: '1px solid #fecaca', borderLeft: '5px solid var(--mubs-red)', borderRadius: '10px', color: '#7f1d1d' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>info</span>
                        <div>These proposals were <strong>rejected</strong> by the Principal or Admin. Review the feedback below. You may revise and resubmit where applicable.</div>
                    </div>

                    <div className="proposal-card rejected mb-3">
                        <div className="d-flex align-items-start gap-3 flex-wrap">
                            <div className="activity-icon" style={{ background: 'rgba(227,24,55,.08)', borderColor: 'rgba(227,24,55,.15)' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>gavel</span></div>
                            <div className="flex-fill">
                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                    <div className="proposal-title">Third-Party Accreditation Programme</div>
                                    <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span>
                                </div>
                                <div className="proposal-meta">Meeting #7 · Submitted 01 Apr · Rejected 08 Apr 2025 by: Principal Prof. R. Wamala</div>
                                <div className="mt-3 p-3 rounded" style={{ background: '#fff1f2', border: '1px solid #fecaca', borderLeft: '4px solid var(--mubs-red)' }}>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-red)' }}>feedback</span>
                                        <span className="fw-black text-dark" style={{ fontSize: '.85rem' }}>Rejection Reason &amp; Feedback</span>
                                    </div>
                                    <p style={{ fontSize: '.84rem', color: '#7f1d1d', margin: 0, lineHeight: 1.65 }}>"This proposal conflicts with NCHE regulations that restrict private institutions from granting third-party accreditation authority. Additionally, the financial model presented underestimates operational costs by approximately 40%. The committee is advised to engage NCHE directly before resubmitting."</p>
                                    <div className="text-muted mt-2" style={{ fontSize: '.73rem' }}>— Principal Prof. R. Wamala · 08 Apr 2025</div>
                                </div>
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <a href="/committee?pg=propose" className="btn btn-sm fw-bold text-white d-flex align-items-center" style={{ background: '#7c3aed' }}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>edit</span>Revise &amp; Resubmit
                                    </a>
                                    <button className="btn btn-sm btn-outline-secondary fw-bold d-flex align-items-center" onClick={() => alert('Opening minutes PDF...')}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>description</span>View Minutes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            {renderContent()}

            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Header closeButton style={{ background: '#7c3aed', color: '#fff', borderRadius: '.5rem .5rem 0 0' }}>
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">description</span> Proposal Detail
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {modalType === 'approved' && (
                        <div className="row g-3">
                            <div className="col-md-6"><div className="fw-bold small text-muted">Title</div><div className="fw-bold text-dark">Research Ethics Framework</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Status</div><span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Pillar</div><div className="fw-bold text-dark">Research &amp; Innovation</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Priority</div><div className="fw-bold text-dark">High</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Meeting Reference</div><div className="fw-bold text-dark">Meeting #7 · 03 Apr 2025</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Approved By</div><div className="fw-bold text-dark">Principal Prof. R. Wamala</div></div>
                            <div className="col-12"><div className="fw-bold small text-muted mb-1">Description</div>
                                <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.84rem', color: '#334155', lineHeight: 1.7 }}>Establish a formal research ethics review framework including an institutional review board, standardised data collection guidelines, and a researcher misconduct reporting mechanism aligned with the 2024–28 strategic plan.</div>
                            </div>
                            <div className="col-12"><div className="fw-bold small text-muted mb-2">Assigned Department (Read Only)</div>
                                <div className="p-3 rounded" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                    <div className="row g-2"><div className="col-4"><div className="text-muted" style={{ fontSize: '.72rem' }}>Department</div><div className="fw-bold text-dark">Research &amp; Innovation</div></div><div className="col-4"><div className="text-muted" style={{ fontSize: '.72rem' }}>HOD</div><div className="fw-bold text-dark">Dr. M. Kizito</div></div><div className="col-4"><div className="text-muted" style={{ fontSize: '.72rem' }}>Progress</div><div className="fw-bold" style={{ color: '#059669' }}>29% In Progress</div></div></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {modalType === 'pending' && (
                        <div className="row g-3">
                            <div className="col-md-6"><div className="fw-bold small text-muted">Title</div><div className="fw-bold text-dark">AI Integration Policy for Teaching</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Status</div><span className="status-badge" style={{ background: '#fef9c3', color: '#a16207' }}>Pending — Principal Review</span></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Pillar</div><div className="fw-bold text-dark">Teaching &amp; Learning</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Priority</div><div className="fw-bold text-dark">High</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Meeting Reference</div><div className="fw-bold text-dark">Meeting #8 · 10 Apr 2025</div></div>
                            <div className="col-12"><div className="fw-bold small text-muted mb-1">Description</div>
                                <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.84rem', color: '#334155', lineHeight: 1.7 }}>Develop and ratify an institutional policy governing the use of artificial intelligence tools in teaching, assessment, and academic research. Policy to cover acceptable AI tools, plagiarism boundaries, student disclosure requirements, and faculty training expectations.</div>
                            </div>
                            <div className="col-12">
                                <div className="p-3 rounded" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '.83rem' }}>⏳ Awaiting Decision</div>
                                    <p style={{ fontSize: '.8rem', color: '#713f12', margin: 0 }}>This proposal has passed Admin review and is currently with the Principal for final decision. Expected response: 2–5 working days.</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {modalType === 'rejected' && (
                        <div className="row g-3">
                            <div className="col-md-6"><div className="fw-bold small text-muted">Title</div><div className="fw-bold text-dark">Third-Party Accreditation Programme</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Status</div><span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Submitted</div><div className="fw-bold text-dark">01 Apr 2025</div></div>
                            <div className="col-md-6"><div className="fw-bold small text-muted">Rejected On</div><div className="fw-bold text-dark">08 Apr 2025</div></div>
                            <div className="col-12"><div className="fw-bold small text-muted mb-1">Description</div>
                                <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.84rem', color: '#334155', lineHeight: 1.7 }}>Establish a MUBS-led third-party accreditation body to certify business programmes at peer institutions in the region, generating revenue and brand recognition.</div>
                            </div>
                            <div className="col-12"><div className="fw-bold small text-muted mb-1">Rejection Feedback</div>
                                <div className="p-3 rounded" style={{ background: '#fff1f2', borderLeft: '4px solid var(--mubs-red)' }}>
                                    <p style={{ fontSize: '.84rem', color: '#7f1d1d', margin: 0, lineHeight: 1.65 }}>"This proposal conflicts with NCHE regulations that restrict private institutions from granting third-party accreditation authority. The committee is advised to engage NCHE directly before resubmitting."</p>
                                    <div className="text-muted mt-1" style={{ fontSize: '.73rem' }}>— Principal Prof. R. Wamala · 08 Apr 2025</div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowModal(false)}>Close</Button>
                    <Button style={{ background: 'var(--mubs-yellow)', color: 'var(--mubs-navy)', borderColor: 'var(--mubs-yellow)' }} className="fw-bold" onClick={() => alert('Proposal downloaded.')}>
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>download</span>Export PDF
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
