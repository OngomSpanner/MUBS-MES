"use client";

import React from 'react';

export default function CommitteeNotifications() {
    return (
        <div id="page-notifications" className="page-section active-page">
            <div className="row g-4">
                <div className="mb-3">
                    <div className="table-card" style={{ borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
                        <div className="table-card-header" style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h5 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>notifications</span>All Notifications</h5>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => alert('All notifications marked as read.')}>Mark all read</button>
                                <select className="form-select form-select-sm" style={{ width: '130px' }}><option>All</option><option>Unread</option><option>Approvals</option><option>Rejections</option></select>
                            </div>
                        </div>
                        <div>
                            <div className="notif-item unread" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#eff6ff', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Approved: Research Ethics Framework</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Approved by Principal Prof. R. Wamala · Assigned to: Research &amp; Innovation</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Today, 09:15 AM</div>
                                </div>
                                <div className="unread-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mubs-blue)', flexShrink: 0, marginTop: '6px' }}></div>
                            </div>
                            <div className="notif-item unread" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#eff6ff', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#eff6ff' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>assignment_ind</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Department Assigned: Research &amp; Innovation — Research Ethics Framework</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>HOD Dr. M. Kizito has been notified and will begin implementation tracking</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Today, 09:16 AM</div>
                                </div>
                                <div className="unread-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mubs-blue)', flexShrink: 0, marginTop: '6px' }}></div>
                            </div>
                            <div className="notif-item unread" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#eff6ff', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fffbeb' }}><span className="material-symbols-outlined" style={{ color: '#b45309' }}>hourglass_top</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Under Review: AI Integration Policy for Teaching</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Passed Admin review — now with Principal for final decision. Expected: 2–5 working days.</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Yesterday, 14:30 PM</div>
                                </div>
                                <div className="unread-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mubs-blue)', flexShrink: 0, marginTop: '6px' }}></div>
                            </div>
                            <div className="notif-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fee2e2' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>cancel</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Rejected: Third-Party Accreditation Programme</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Reason: Conflicts with NCHE regulations. Feedback available. You may revise and resubmit.</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>08 Apr 2025, 11:00 AM</div>
                                </div>
                            </div>
                            <div className="notif-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f5f3ff' }}><span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>post_add</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Submitted: Student Fee Restructuring 2025–26</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Your proposal was successfully submitted and is now with Admin for review</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>12 Apr 2025, 10:05 AM</div>
                                </div>
                            </div>
                            <div className="notif-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '.9rem', padding: '.85rem 1rem', cursor: 'pointer' }}>
                                <div className="notif-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Approved: Digital Literacy for Staff</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Approved · Assigned to Faculty of Computing · HOD Dr. A. Ssekandi notified</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>02 Apr 2025, 09:00 AM</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
