"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Modal, Button } from 'react-bootstrap';
import axios from 'axios';
import ComplianceGrid from '@/components/Tracking/ComplianceGrid';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell
} from 'recharts';

interface DepartmentProgress {
    name: string;
    activities: number;
    progress: number;
    delayed: number;
    health: 'Good' | 'Watch' | 'Critical';
}

interface Alert {
    activity_id?: number;
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


const statusToLabel = (status: string) => {
    switch (status) {
        case 'completed': return 'DONE';
        case 'in_progress': return 'ACTIVE';
        case 'overdue': return 'OVERDUE';
        case 'pending': return 'PENDING';
        default: return status?.toUpperCase() || '-';
    }
};

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
    const [remindingId, setRemindingId] = useState<number | null>(null);
    const [complianceData, setComplianceData] = useState<{ months: string[]; grid: any[] }>({ months: [], grid: [] });
    const [loadingCompliance, setLoadingCompliance] = useState(true);

    const [deptExecutionStats, setDeptExecutionStats] = useState<any[]>([]);
    const [velocityStats, setVelocityStats] = useState<any[]>([]);
    const [allActivities, setAllActivities] = useState<any[]>([]);

    useEffect(() => { setUnitPage(1); }, [healthFilter]);
    useEffect(() => { setDelayedPage(1); }, [delayedUnitFilter]);
    useEffect(() => { fetchTrackingData(); }, []);

    const fetchTrackingData = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('/api/tracking');
            setUnitProgress(data.departmentProgress);
            setAlerts(data.alerts);
            setDelayedActivities(data.delayedActivities);
            setSummary(data.summary);

            // Fetch all activities for advanced charts
            const { data: acts } = await axios.get('/api/activities');
            const activities = Array.isArray(acts) ? acts : [];
            setAllActivities(activities);

            // 1. Compute Dept. Execution Stats (Stacked Bar)
            const deptMap: Record<string, any> = {};
            activities.forEach(a => {
                const dept = a.faculty_office || a.department || 'Other';
                if (!deptMap[dept]) deptMap[dept] = { name: dept, completed: 0, inProgress: 0, overdue: 0 };
                if (a.status === 'completed') deptMap[dept].completed++;
                else if (a.status === 'in_progress') deptMap[dept].inProgress++;
                else if (a.status === 'overdue') deptMap[dept].overdue++;
            });
            setDeptExecutionStats(Object.values(deptMap).sort((a: any, b: any) => (b.completed + b.inProgress + b.overdue) - (a.completed + a.inProgress + a.overdue)).slice(0, 6));

            // 2. Compute Velocity Stats (Area Chart)
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const velMap: Record<string, number> = {};
            activities.filter(a => a.status === 'completed').forEach(a => {
                const d = new Date(a.end_date || a.updated_at || Date.now());
                const m = months[d.getMonth()];
                velMap[m] = (velMap[m] || 0) + 1;
            });
            // Order months correctly based on current timeline (Oct to Apr as in screenshot)
            const order = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr'];
            setVelocityStats(order.map(m => ({ name: m, value: velMap[m] || 0 })));

            // Fetch compliance grid
            setLoadingCompliance(true);
            const compRes = await axios.get('/api/admin/compliance');
            setComplianceData(compRes.data);
        } catch (error) {
            console.error('Error fetching tracking data:', error);
        } finally {
            setLoading(false);
            setLoadingCompliance(false);
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

    const sendReminder = async (title: string, activityId?: number) => {
        if (activityId == null) {
            const act = delayedActivities.find(a => a.title === title);
            activityId = act?.id;
        }
        if (activityId == null) {
            alert('Activity not found.');
            return;
        }
        setRemindingId(activityId);
        try {
            const res = await axios.post('/api/tracking/reminder', { activity_id: activityId, title }, { withCredentials: true });
            alert(res.data?.message ?? `Reminder sent for: ${title}`);
        } catch (e: any) {
            console.error(e);
            const msg = e.response?.data?.message ?? e.response?.data?.detail ?? 'Failed to send reminder.';
            alert(msg);
        } finally {
            setRemindingId(null);
        }
    };

    const openEscalate = (activity: DelayedActivity) => {
        setEscalateTarget(activity);
        setShowEscalate(true);
    };

    const confirmEscalate = async () => {
        if (!escalateTarget) return;
        setEscalating(true);
        try {
            const res = await axios.post('/api/tracking/escalate', {
                activity_id: escalateTarget.id,
                title: escalateTarget.title
            });
            alert(res.data?.message ?? `Escalation submitted for: ${escalateTarget.title}`);
            setShowEscalate(false);
            setEscalateTarget(null);
            fetchTrackingData();
        } catch (e) {
            console.error(e);
            alert('Failed to submit escalation.');
        } finally {
            setEscalating(false);
        }
    };

    return (
        <Layout>
            {/* Execution Charts Row */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-lg-6">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: '#10b981' }}>
                                    bar_chart
                                </span>
                                Dept. Execution Status
                            </h5>
                        </div>
                        <div className="p-4" style={{ height: '280px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={deptExecutionStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend verticalAlign="top" height={36} align="center" iconType="circle" />
                                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={32} />
                                    <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={32} />
                                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-6">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: '#a855f7' }}>
                                    trending_up
                                </span>
                                Completion Velocity
                            </h5>
                        </div>
                        <div className="p-4" style={{ height: '280px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={velocityStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend verticalAlign="top" height={36} align="center" iconType="circle" />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        name="Completed/month" 
                                        stroke="#10b981" 
                                        strokeWidth={3} 
                                        fillOpacity={1} 
                                        fill="url(#colorVelocity)" 
                                        dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* All Activities Table */}
            <div className="table-card">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: '#f59e0b' }}>
                            assignment
                        </span>
                        All Activities
                    </h5>
                    <span className="badge bg-dark px-3 py-2 rounded-pill" style={{ fontSize: '.7rem', letterSpacing: '.02em', background: '#1e293b !important' }}>
                        156 total
                    </span>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Activity</th>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Department</th>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Assigned To</th>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Due</th>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Progress</th>
                                <th style={{ fontSize: '.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, padding: '16px 20px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allActivities.slice(0, 10).map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{row.title}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div className="text-muted" style={{ fontSize: '.83rem' }}>{row.department}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div className="text-muted" style={{ fontSize: '.83rem' }}>{row.assigned_to || 'Admin'}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div className="small fw-semibold" style={{ color: row.status === 'overdue' ? '#ef4444' : '#64748b' }}>
                                            {row.status === 'completed' ? 'Done' : (row.end_date ? new Date(row.end_date).toLocaleDateString() : '—')}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div className="d-flex align-items-center gap-2" style={{ width: '120px' }}>
                                            <div className="progress flex-grow-1" style={{ height: '6px', borderRadius: '3px', background: '#f1f5f9' }}>
                                                <div className="progress-bar" style={{ 
                                                    width: `${row.progress}%`, 
                                                    background: row.progress >= 70 ? '#10b981' : row.progress >= 40 ? '#3b82f6' : '#ef4444', 
                                                    borderRadius: '3px' 
                                                }}></div>
                                            </div>
                                            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#1e293b', minWidth: '32px' }}>{row.progress}%</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span className="status-badge" style={{ 
                                            background: row.status === 'completed' ? '#dcfce7' : row.status === 'in_progress' ? '#eff6ff' : '#fee2e2',
                                            color: row.status === 'completed' ? '#15803d' : row.status === 'in_progress' ? '#1e40af' : '#b91c1c',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontWeight: 700,
                                            fontSize: '.65rem'
                                        }}>
                                            {statusToLabel(row.status)}
                                        </span>
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
            <Modal show={showEscalate} onHide={() => { setShowEscalate(false); setEscalateTarget(null); }} centered backdrop="static" keyboard={false} size="lg">
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
