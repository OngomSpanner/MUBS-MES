"use client";

export default function CommNotifications() {
    return (
        <div className="content-area-comm">
            <div className="row g-4">
                <div className="mb-3">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>notifications</span>All Notifications</h5>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => alert('All notifications marked as read.')}>Mark all read</button>
                                <select className="form-select form-select-sm" style={{ width: '130px' }} defaultValue="All">
                                    <option>All</option>
                                    <option>Unread</option>
                                    <option>Approvals</option>
                                    <option>Rejections</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <div className="notif-item unread">
                                <div className="notif-icon" style={{ background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Approved: Research Ethics Framework</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Approved by Principal Prof. R. Wamala · Assigned to: Research &amp; Innovation</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Today, 09:15 AM</div>
                                </div>
                                <div className="unread-dot"></div>
                            </div>
                            <div className="notif-item unread">
                                <div className="notif-icon" style={{ background: '#eff6ff' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>assignment_ind</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Department Assigned: Research &amp; Innovation — Research Ethics Framework</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>HOD Dr. M. Kizito has been notified and will begin implementation tracking</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Today, 09:16 AM</div>
                                </div>
                                <div className="unread-dot"></div>
                            </div>
                            <div className="notif-item unread">
                                <div className="notif-icon" style={{ background: '#fffbeb' }}><span className="material-symbols-outlined" style={{ color: '#b45309' }}>hourglass_top</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Under Review: AI Integration Policy for Teaching</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Passed Admin review — now with Principal for final decision. Expected: 2–5 working days.</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>Yesterday, 14:30 PM</div>
                                </div>
                                <div className="unread-dot"></div>
                            </div>
                            <div className="notif-item">
                                <div className="notif-icon" style={{ background: '#fee2e2' }}><span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>cancel</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Rejected: Third-Party Accreditation Programme</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Reason: Conflicts with NCHE regulations. Feedback available. You may revise and resubmit.</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>08 Apr 2025, 11:00 AM</div>
                                </div>
                            </div>
                            <div className="notif-item">
                                <div className="notif-icon" style={{ background: '#f5f3ff' }}><span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>post_add</span></div>
                                <div className="flex-fill">
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Proposal Submitted: Student Fee Restructuring 2025–26</div>
                                    <div className="text-muted" style={{ fontSize: '.73rem' }}>Your proposal was successfully submitted and is now with Admin for review</div>
                                    <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>12 Apr 2025, 10:05 AM</div>
                                </div>
                            </div>
                            <div className="notif-item">
                                <div className="notif-icon" style={{ background: '#dcfce7' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>check_circle</span></div>
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
