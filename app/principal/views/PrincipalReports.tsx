'use client';
import React from 'react';

export default function PrincipalReports() {
    return (
        <div id="page-reports" className="page-section active-page">
            {/* Report type cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-blue)' }}>
                        <div className="report-card-icon" style={{ background: '#eff6ff' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '26px' }}>summarize</span>
                        </div>
                        <h6>Executive Summary</h6>
                        <p>Full institutional progress overview with KPIs, compliance rates, and risk highlights.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-primary fw-bold flex-fill" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary w-100 mt-2">
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>

                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: '#10b981' }}>
                        <div className="report-card-icon" style={{ background: '#ecfdf5' }}>
                            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '26px' }}>corporate_fare</span>
                        </div>
                        <h6>Department Performance Report</h6>
                        <p>Per-department activity completion rates, compliance scores, and comparative analysis across departments.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-success fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary w-100 mt-2">
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>

                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-yellow)' }}>
                        <div className="report-card-icon" style={{ background: '#fffbeb' }}>
                            <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: '26px' }}>person_search</span>
                        </div>
                        <h6>Staff Evaluation Report</h6>
                        <p>Individual and departmental evaluation scores, completion rates, and performance trends.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm fw-bold flex-fill text-dark" style={{ background: 'var(--mubs-yellow)', borderColor: 'var(--mubs-yellow)' }}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-success fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary w-100 mt-2">
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>

                <div className="col-12 col-md-6 col-xl-3">
                    <div className="report-card" style={{ borderTopColor: 'var(--mubs-red)' }}>
                        <div className="report-card-icon" style={{ background: '#fff1f2' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '26px' }}>crisis_alert</span>
                        </div>
                        <h6>Risk &amp; Delayed Activities</h6>
                        <p>Comprehensive view of all overdue activities, escalation logs, and risk mitigation status.</p>
                        <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-sm btn-danger fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>picture_as_pdf</span>PDF
                            </button>
                            <button className="btn btn-sm btn-outline-danger fw-bold flex-fill">
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>table_chart</span>Excel
                            </button>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary w-100 mt-2">
                            <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>share</span>Share Summary
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent reports generated */}
            <div className="row g-4">
                <div className="col-12 col-lg-7">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>history</span>Recently Generated Reports</h5>
                            <button className="btn btn-sm btn-outline-secondary">Clear History</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead><tr><th>Report</th><th>Generated</th><th>Format</th><th>Actions</th></tr></thead>
                                <tbody>
                                    <tr>
                                        <td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Executive Summary — Q1 2025</div><div className="text-muted" style={{ fontSize: '.72rem' }}>Covers Jan–Mar 2025</div></td>
                                        <td style={{ fontSize: '.83rem' }}>15 Apr 2025, 10:22 AM</td>
                                        <td><span className="badge bg-danger">PDF</span></td>
                                        <td><div className="d-flex gap-1"><button className="btn btn-xs btn-outline-primary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span></button><button className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span></button><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span></button></div></td>
                                    </tr>
                                    <tr>
                                        <td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Department Performance Snapshot — Mar 2025</div><div className="text-muted" style={{ fontSize: '.72rem' }}>All 14 academic departments</div></td>
                                        <td style={{ fontSize: '.83rem' }}>12 Apr 2025, 02:14 PM</td>
                                        <td><span className="badge bg-success">Excel</span></td>
                                        <td><div className="d-flex gap-1"><button className="btn btn-xs btn-outline-primary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span></button><button className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span></button><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span></button></div></td>
                                    </tr>
                                    <tr>
                                        <td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Risk &amp; Delayed Activities — Apr 2025</div><div className="text-muted" style={{ fontSize: '.72rem' }}>5 overdue, 7 at risk</div></td>
                                        <td style={{ fontSize: '.83rem' }}>10 Apr 2025, 09:00 AM</td>
                                        <td><span className="badge bg-danger">PDF</span></td>
                                        <td><div className="d-flex gap-1"><button className="btn btn-xs btn-outline-primary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span></button><button className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span></button><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span></button></div></td>
                                    </tr>
                                    <tr>
                                        <td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>Staff Evaluations — Annual 2024</div><div className="text-muted" style={{ fontSize: '.72rem' }}>86 staff · Full year</div></td>
                                        <td style={{ fontSize: '.83rem' }}>02 Jan 2025, 11:45 AM</td>
                                        <td><span className="badge bg-success">Excel</span></td>
                                        <td><div className="d-flex gap-1"><button className="btn btn-xs btn-outline-primary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span></button><button className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span></button><button className="btn btn-xs btn-outline-secondary py-0 px-2" style={{ fontSize: '.75rem' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>share</span></button></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="table-card-footer">
                            <span className="footer-label">4 reports in history</span>
                            <button className="btn btn-sm btn-primary fw-bold" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>Download All
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scheduled & quick generate */}
                <div className="col-12 col-lg-5 d-flex flex-column gap-4">

                    {/* Schedule */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>schedule_send</span>Scheduled Reports</h5>
                            <button className="btn btn-sm btn-outline-primary">+ Schedule</button>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Monthly Executive Summary</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>Every 1st of month · PDF · Email</div>
                                </div>
                                <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.62rem' }}>Active</span>
                            </div>
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Quarterly Risk Report</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>End of each quarter · PDF</div>
                                </div>
                                <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.62rem' }}>Active</span>
                            </div>
                            <div className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '20px' }}>event_repeat</span>
                                <div className="flex-fill">
                                    <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#0f172a' }}>Annual Staff Evaluation</div>
                                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>Dec 31 · Excel · Board Package</div>
                                </div>
                                <span className="status-badge" style={{ background: '#fef9c3', color: '#a16207', fontSize: '.62rem' }}>Upcoming</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick generate */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>bolt</span>Quick Generate</h5>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <div className="row g-2">
                                <div className="col-6"><select className="form-select form-select-sm" defaultValue="Q1 2025"><option>Q1 2025</option><option>Q2 2025</option><option>Annual 2024</option></select></div>
                                <div className="col-6"><select className="form-select form-select-sm" defaultValue="Executive Summary"><option>Executive Summary</option><option>Department Performance</option><option>Staff Evaluation</option><option>Risk Report</option></select></div>
                            </div>
                            <div className="row g-2">
                                <div className="col-6"><select className="form-select form-select-sm" defaultValue="PDF"><option>PDF</option><option>Excel</option></select></div>
                                <div className="col-6">
                                    <button className="btn btn-sm w-100 fw-bold text-white" style={{ background: 'var(--mubs-blue)' }}>
                                        <span className="material-symbols-outlined me-1" style={{ fontSize: '15px' }}>auto_awesome</span>Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
