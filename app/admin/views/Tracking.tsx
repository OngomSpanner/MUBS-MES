"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Modal, Button } from 'react-bootstrap';
import axios from 'axios';

interface DepartmentProgress {
    name: string;
    activities: number;
    progress: number;
    delayed: number;
    health: 'Good' | 'Watch' | 'Critical';
}

interface Alert {
    title: string;
    description: string;
    days: number;
    type: 'overdue' | 'due';
    department: string;
}

interface DelayedActivity {
    id: number;
    title: string;
    department: string;
    deadline: string;
    daysOverdue: number;
    progress: number;
}

interface Summary {
    onTrack: number;
    delayed: number;
    atRisk: number;
    alerts: number;
}

export default function TrackingView() {
    const [departmentProgress, setUnitProgress] = useState<DepartmentProgress[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [delayedActivities, setDelayedActivities] = useState<DelayedActivity[]>([]);
    const [summary, setSummary] = useState<Summary>({ onTrack: 0, delayed: 0, atRisk: 0, alerts: 0 });
    const [loading, setLoading] = useState(true);
    const [healthFilter, setHealthFilter] = useState('All');
    const [departmentPage, setUnitPage] = useState(1);
    const UNIT_PAGE_SIZE = 5;
    const [delayedUnitFilter, setDelayedUnitFilter] = useState('All Departments');
    const [delayedPage, setDelayedPage] = useState(1);
    const DELAYED_PAGE_SIZE = 5;
    const [escalateTarget, setEscalateTarget] = useState<DelayedActivity | null>(null);
    const [showEscalate, setShowEscalate] = useState(false);
    const [escalating, setEscalating] = useState(false);

    useEffect(() => { setUnitPage(1); }, [healthFilter]);
    useEffect(() => { setDelayedPage(1); }, [delayedUnitFilter]);
    useEffect(() => { fetchTrackingData(); }, []);

    const fetchTrackingData = async () => {
        try {
            const { data } = await axios.get('/api/tracking');
            setUnitProgress(data.departmentProgress);
            setAlerts(data.alerts);
            setDelayedActivities(data.delayedActivities);
            setSummary(data.summary);
        } catch (error) {
            console.error('Error fetching tracking data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getHealthBadge = (health: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'Good': { bg: '#dcfce7', color: '#15803d' },
            'Watch': { bg: '#fef9c3', color: '#a16207' },
            'Critical': { bg: '#fee2e2', color: '#b91c1c' }
        };
        return styles[health] || { bg: '#f1f5f9', color: '#475569' };
    };

    const filteredUnits = healthFilter === 'All'
        ? departmentProgress
        : departmentProgress.filter(u => u.health === healthFilter);
    const departmentTotalPages = Math.max(1, Math.ceil(filteredUnits.length / UNIT_PAGE_SIZE));
    const paginatedUnits = filteredUnits.slice((departmentPage - 1) * UNIT_PAGE_SIZE, departmentPage * UNIT_PAGE_SIZE);

    const uniqueDelayedUnits = Array.from(new Set(delayedActivities.map(a => a.department))).filter(Boolean);
    const filteredDelayed = delayedUnitFilter === 'All Departments'
        ? delayedActivities
        : delayedActivities.filter(a => a.department === delayedUnitFilter);
    const delayedTotalPages = Math.max(1, Math.ceil(filteredDelayed.length / DELAYED_PAGE_SIZE));
    const paginatedDelayed = filteredDelayed.slice((delayedPage - 1) * DELAYED_PAGE_SIZE, delayedPage * DELAYED_PAGE_SIZE);

    const sendReminder = (title: string) => alert(`Reminder sent for: ${title}`);

    const openEscalate = (activity: DelayedActivity) => {
        setEscalateTarget(activity);
        setShowEscalate(true);
    };

    const confirmEscalate = async () => {
        if (!escalateTarget) return;
        setEscalating(true);
        // Here you would call your escalation API; for now we simulate a brief delay
        await new Promise(r => setTimeout(r, 800));
        setEscalating(false);
        setShowEscalate(false);
        setEscalateTarget(null);
        alert(`Escalation submitted for: ${escalateTarget.title}`);
    };

    return (
        <Layout>
            <div className="alert alert-danger alert-strip alert-dismissible fade show mb-4 d-flex align-items-center gap-2" role="alert">
                <span className="material-symbols-outlined">alarm</span>
                <div>
                    <strong>{summary.delayed} activities</strong> are overdue. Immediate action required.&nbsp;
                    <a href="#delayedTable" className="alert-link">Jump to delayed →</a>
                </div>
                <button type="button" className="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>

            {/* Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                                <span className="material-symbols-outlined" style={{ color: '#059669' }}>verified</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#ecfdf5', color: '#059669' }}>Good</span>
                        </div>
                        <div className="stat-label">On Track</div>
                        <div className="stat-value">{summary.onTrack}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fffbeb' }}>
                                <span className="material-symbols-outlined" style={{ color: '#b45309' }}>hourglass_empty</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#fffbeb', color: '#b45309' }}>Watch</span>
                        </div>
                        <div className="stat-label">At Risk</div>
                        <div className="stat-value">{summary.atRisk}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-red)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fff1f2' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>running_with_errors</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#fff1f2', color: 'var(--mubs-red)' }}>Critical</span>
                        </div>
                        <div className="stat-label">Delayed</div>
                        <div className="stat-value">{summary.delayed}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-blue)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#eff6ff' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>notifications_active</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Active</span>
                        </div>
                        <div className="stat-label">Alerts Issued</div>
                        <div className="stat-value">{summary.alerts}</div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                {/* Department progress table */}
                <div className="col-12 col-lg-7">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                                    corporate_fare
                                </span>
                                All Departments Progress
                            </h5>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '130px' }}
                                value={healthFilter}
                                onChange={e => setHealthFilter(e.target.value)}
                            >
                                <option value="All">All Health</option>
                                <option value="Good">Good</option>
                                <option value="Watch">Watch</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Activities</th>
                                        <th>Avg. Progress</th>
                                        <th>Delayed</th>
                                        <th>Health</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedUnits.map((department, index) => {
                                        const healthStyle = getHealthBadge(department.health);
                                        return (
                                            <tr key={index}>
                                                <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{department.name}</td>
                                                <td style={{ fontSize: '.83rem' }}>{department.activities}</td>
                                                <td>
                                                    <div className="progress-bar-custom" style={{ width: '120px', display: 'inline-block' }}>
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{
                                                                width: `${department.progress}%`,
                                                                background: department.progress >= 70 ? '#10b981' :
                                                                    department.progress >= 50 ? '#ffcd00' : '#e31837'
                                                            }}
                                                        />
                                                    </div>
                                                    <span style={{ fontSize: '.75rem', color: '#475569', marginLeft: '6px' }}>
                                                        {department.progress}%
                                                    </span>
                                                </td>
                                                <td>
                                                    {department.delayed === 0 ? (
                                                        <span className="badge bg-success">0</span>
                                                    ) : department.delayed === 1 ? (
                                                        <span className="badge bg-warning text-dark">{department.delayed}</span>
                                                    ) : (
                                                        <span className="badge bg-danger">{department.delayed}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="status-badge" style={{ background: healthStyle.bg, color: healthStyle.color }}>
                                                        {department.health}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Paginator */}
                        <div className="table-card-footer">
                            <span className="footer-label">
                                Showing {filteredUnits.length === 0 ? 0 : (departmentPage - 1) * UNIT_PAGE_SIZE + 1}–{Math.min(departmentPage * UNIT_PAGE_SIZE, filteredUnits.length)} of {filteredUnits.length} departments
                            </span>
                            <div className="d-flex gap-1">
                                <button className="page-btn" disabled={departmentPage === 1} onClick={() => setUnitPage(p => p - 1)}>‹</button>
                                {Array.from({ length: departmentTotalPages }, (_, i) => i + 1).map(pg => (
                                    <button
                                        key={pg}
                                        className={`page-btn ${pg === departmentPage ? 'active' : ''}`}
                                        onClick={() => setUnitPage(pg)}
                                    >{pg}</button>
                                ))}
                                <button className="page-btn" disabled={departmentPage === departmentTotalPages} onClick={() => setUnitPage(p => p + 1)}>›</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts panel */}
                <div className="col-12 col-lg-5">
                    <div className="table-card h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>
                                    notifications_active
                                </span>
                                Active Deadline Alerts
                            </h5>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => alert('All alerts marked as read')}>
                                Mark All Read
                            </button>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            {alerts.length === 0 && !loading ? (
                                <p className="text-muted small text-center py-3 mb-0">No active alerts 🎉</p>
                            ) : alerts.map((al, index) => (
                                <div
                                    key={index}
                                    className="d-flex align-items-start gap-3 p-2 rounded"
                                    style={{
                                        background: al.type === 'overdue' ? '#fff1f2' : '#fffbeb',
                                        borderLeft: al.type === 'overdue' ? '3px solid #e31837' : '3px solid #ffcd00'
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined mt-1"
                                        style={{ fontSize: '18px', color: al.type === 'overdue' ? '#e31837' : '#b45309' }}
                                    >
                                        {al.type === 'overdue' ? 'alarm_on' : 'schedule'}
                                    </span>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{al.title}</div>
                                        <div className="text-muted" style={{ fontSize: '.73rem' }}>
                                            {al.description} · {al.department}
                                        </div>
                                        <button
                                            className={`btn btn-xs py-0 px-2 mt-1 ${al.type === 'overdue' ? 'btn-danger' : 'btn-warning'}`}
                                            style={{ fontSize: '.72rem' }}
                                            onClick={() => sendReminder(al.title)}
                                        >
                                            {al.type === 'overdue' ? 'Send Reminder' : 'Notify Department'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delayed Activities Detail */}
            <div className="table-card" id="delayedTable">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>
                            running_with_errors
                        </span>
                        Delayed Activities — Detail View
                    </h5>
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '150px' }}
                        value={delayedUnitFilter}
                        onChange={e => setDelayedUnitFilter(e.target.value)}
                    >
                        <option>All Departments</option>
                        {uniqueDelayedUnits.map(u => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead>
                            <tr>
                                <th>Activity</th>
                                <th>Department</th>
                                <th>Deadline</th>
                                <th>Days Overdue</th>
                                <th>Progress</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDelayed.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-4 text-muted">No delayed activities 🎉</td>
                                </tr>
                            ) : paginatedDelayed.map((activity) => (
                                <tr key={activity.id}>
                                    <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{activity.title}</td>
                                    <td style={{ fontSize: '.83rem' }}>{activity.department}</td>
                                    <td style={{ fontSize: '.83rem' }}>{activity.deadline}</td>
                                    <td>
                                        <span className="badge bg-danger">
                                            {activity.daysOverdue === 0 ? 'Today' : `+${activity.daysOverdue} days`}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="progress-bar-custom" style={{ width: '80px', display: 'inline-block' }}>
                                            <div
                                                className="progress-bar-fill"
                                                style={{
                                                    width: `${activity.progress}%`,
                                                    background: activity.progress >= 70 ? '#10b981' :
                                                        activity.progress >= 50 ? '#ffcd00' : '#e31837'
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '.75rem', marginLeft: '6px', color: '#64748b' }}>
                                            {activity.progress}%
                                        </span>
                                    </td>
                                    <td>
                                        {activity.daysOverdue > 10 ? (
                                            <button
                                                className="btn btn-xs btn-danger py-0 px-2 fw-bold"
                                                style={{ fontSize: '.75rem' }}
                                                onClick={() => openEscalate(activity)}
                                            >
                                                Escalate
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-xs btn-warning py-0 px-2 fw-bold text-dark"
                                                style={{ fontSize: '.75rem' }}
                                                onClick={() => sendReminder(activity.title)}
                                            >
                                                Remind
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">
                        Showing {filteredDelayed.length === 0 ? 0 : (delayedPage - 1) * DELAYED_PAGE_SIZE + 1}–{Math.min(delayedPage * DELAYED_PAGE_SIZE, filteredDelayed.length)} of {filteredDelayed.length} activities
                    </span>
                    <div className="d-flex gap-1">
                        <button className="page-btn" disabled={delayedPage === 1} onClick={() => setDelayedPage(p => p - 1)}>‹</button>
                        {Array.from({ length: delayedTotalPages }, (_, i) => i + 1).map(pg => (
                            <button
                                key={pg}
                                className={`page-btn ${pg === delayedPage ? 'active' : ''}`}
                                onClick={() => setDelayedPage(pg)}
                            >{pg}</button>
                        ))}
                        <button className="page-btn" disabled={delayedPage === delayedTotalPages} onClick={() => setDelayedPage(p => p + 1)}>›</button>
                    </div>
                </div>
            </div>
            {/* Escalate Confirm Modal */}
            <Modal show={showEscalate} onHide={() => { setShowEscalate(false); setEscalateTarget(null); }} centered>
                <Modal.Header closeButton className="modal-header-mubs">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>priority_high</span>
                        Escalate Activity
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {escalateTarget && (
                        <div>
                            <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>running_with_errors</span>
                                <div>
                                    <strong>{escalateTarget.title}</strong> is overdue by{' '}
                                    <strong>{escalateTarget.daysOverdue} days</strong>
                                </div>
                            </div>
                            <p className="text-dark small mb-1">
                                Escalating will notify senior management and flag this activity for immediate intervention.
                            </p>
                            <div className="row g-2 mt-1">
                                <div className="col-6">
                                    <div className="small text-muted fw-bold">Department</div>
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{escalateTarget.department}</div>
                                </div>
                                <div className="col-6">
                                    <div className="small text-muted fw-bold">Progress</div>
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{escalateTarget.progress}%</div>
                                </div>
                                <div className="col-6">
                                    <div className="small text-muted fw-bold">Deadline</div>
                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{escalateTarget.deadline}</div>
                                </div>
                                <div className="col-6">
                                    <div className="small text-muted fw-bold">Days Overdue</div>
                                    <div className="fw-bold" style={{ color: 'var(--mubs-red)', fontSize: '.85rem' }}>+{escalateTarget.daysOverdue} days</div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => { setShowEscalate(false); setEscalateTarget(null); }} disabled={escalating}>
                        Cancel
                    </Button>
                    <Button
                        style={{ background: 'var(--mubs-red)', borderColor: 'var(--mubs-red)' }}
                        className="fw-bold text-white"
                        disabled={escalating}
                        onClick={confirmEscalate}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>
                            {escalating ? 'hourglass_top' : 'priority_high'}
                        </span>
                        {escalating ? 'Escalating...' : 'Confirm Escalation'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Layout>
    );
}
