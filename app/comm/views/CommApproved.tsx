"use client";

export default function CommApproved() {
    return (
        <div className="content-area-comm">
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
                        <button className="btn btn-sm btn-outline-success fw-bold">View</button>
                    </div>
                </div>

                {/* Approved 2 */}
                <div className="proposal-card approved">
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
                        <button className="btn btn-sm btn-outline-success fw-bold">View</button>
                    </div>
                </div>

                {/* Approved 3 */}
                <div className="proposal-card approved">
                    <div className="d-flex align-items-start gap-3 flex-wrap">
                        <div className="activity-icon" style={{ background: 'rgba(16,185,129,.08)', borderColor: 'rgba(16,185,129,.15)' }}><span className="material-symbols-outlined" style={{ color: '#059669' }}>menu_book</span></div>
                        <div className="flex-fill">
                            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <div className="proposal-title">Open Access Library Repository</div>
                                <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>
                            </div>
                            <div className="proposal-meta">Meeting #6 · Approved 02 Apr 2025 · Pillar: Infrastructure</div>
                            <div className="department-assign-card mt-3">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>assignment_ind</span>
                                    <span className="fw-black text-dark" style={{ fontSize: '.85rem' }}>Assigned Implementation Department</span>
                                    <span className="read-only-badge ms-auto">Read Only</span>
                                </div>
                                <div className="row g-2">
                                    <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Department</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Library Department</div></div>
                                    <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>HOD</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>Mr. J. Byaruhanga</div></div>
                                    <div className="col-sm-4"><div className="text-muted" style={{ fontSize: '.72rem', fontWeight: 700 }}>Target Deadline</div><div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>30 Jun 2025</div></div>
                                </div>
                                <div className="mt-2"><div className="text-muted mb-1" style={{ fontSize: '.72rem', fontWeight: 700 }}>Implementation Progress</div><div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: '78%', background: '#10b981' }}></div></div><span style={{ fontSize: '.72rem', color: '#64748b' }}>78% · On Track</span></div>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-outline-success fw-bold">View</button>
                    </div>
                </div>
            </div>

            <div className="table-card-footer bg-white rounded-3 mt-3">
                <span className="footer-label">Showing 3 of 6 approved proposals</span>
                <div className="d-flex gap-1">
                    <button className="page-btn" disabled>‹</button>
                    <button className="page-btn active">1</button>
                    <button className="page-btn">2</button>
                    <button className="page-btn">›</button>
                </div>
            </div>
        </div>
    );
}
