'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

type PerformancePeriod = 'week' | 'month' | 'quarter';

interface DepartmentHeadData {
    departmentName?: string;
    stats: {
        totalActivities: number;
        onTrack: number;
        delayed: number;
        totalTasks: number;
        pendingSubmissions: number;
        hrAlerts: number;
    };
    departmentalStats?: {
        total: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
    };
    hrWarnings: Array<{
        full_name: string;
        role: string;
        leave_status: string;
        contract_end_date: string | null;
        daysRemaining: number | null;
    }>;
    activityProgress: Array<{
        title: string;
        status: string;
        progress: number;
        end_date: string;
    }>;
    departmentalProgress?: Array<{
        title: string;
        status: string;
        progress: number;
        end_date: string;
    }>;
    recentSubmissions: Array<{
        staff: string;
        task: string;
        date: string;
        status: string;
    }>;
    noDepartment?: boolean;
}

interface PerformanceData {
    performancePercent: number | null;
    totalPoints: number;
    maxPoints: number;
    period: PerformancePeriod;
    timeSeries: Array<{ periodLabel: string; complete: number; incomplete: number; notDone: number; performancePercent: number }>;
    byStaff: Array<{ staffName: string; complete: number; incomplete: number; notDone: number; performancePercent: number }>;
    message?: string;
}

export default function DepartmentHeadDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DepartmentHeadData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performancePeriod, setPerformancePeriod] = useState<PerformancePeriod>('week');
    const [performance, setPerformance] = useState<PerformanceData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/department-head');
                setData(response.data);
            } catch (error: any) {
                console.error('Error fetching department head dashboard data:', error);
                setError(error.response?.data?.message || 'Failed to load department dashboard. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (data?.noDepartment) return;
        const fetchPerf = async () => {
            try {
                const res = await axios.get(`/api/department-head/performance?period=${performancePeriod}`);
                setPerformance(res.data);
            } catch (e: any) {
                setPerformance(null);
            }
        };
        fetchPerf();
    }, [performancePeriod, data?.noDepartment]);

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Dashboard</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const {
        stats,
        hrWarnings,
        activityProgress,
        departmentalProgress = [],
        departmentalStats = { total: 0, onTrack: 0, inProgress: 0, delayed: 0 },
        recentSubmissions,
        noDepartment,
        departmentName,
    } = data;

    if (noDepartment) {
        return (
            <div id="page-dashboard" className="page-section active-page">
                <div className="container py-5">
                    <div className="alert alert-info border-0 shadow-sm d-flex align-items-start gap-3 p-4" role="alert">
                        <span className="material-symbols-outlined fs-1 text-primary">info</span>
                        <div>
                            <h5 className="alert-heading fw-bold mb-2">No department assigned</h5>
                            <p className="mb-0 text-secondary">
                                Your account is not linked to a department or unit. To see activities, staff, and submissions here, an administrator must assign you to a department (e.g. Faculty of Commerce) in User Management.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="page-dashboard" className="page-section active-page">
            {/* Hero banner */}
            <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg, #0d9488 0%, var(--mubs-navy) 100%)', border: '1px solid rgba(94, 234, 212, 0.2)' }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="material-symbols-outlined" style={{ color: '#5eead4', fontSize: '28px' }}>corporate_fare</span>
                            <div>
                                <div className="fw-black text-white" style={{ fontSize: '1.1rem' }}>{departmentName || 'Department Head Dashboard'}</div>
                                <div style={{ fontSize: '.75rem', color: '#99f6e4' }}>Your unit activities, staff, and submissions</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* HR Warning banner */}
            {stats.hrAlerts > 0 && (
                <div className="alert alert-warning alert-strip alert-dismissible fade show mb-4 d-flex align-items-center gap-2" role="alert">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>warning</span>
                    <div>
                        <strong>Department Warnings:</strong> {stats.hrAlerts} staff members require attention (leave or contract expiry).
                        <button type="button" className="alert-link fw-semibold btn btn-link p-0 border-0 text-decoration-underline" onClick={() => router.push('/department-head?pg=staff')}> Review staff →</button>
                    </div>
                    <button type="button" className="btn-close ms-auto" data-bs-dismiss="alert"></button>
                </div>
            )}

            {/* Department Performance % (Complete=2, Incomplete=1, Not Done=0) */}
            {!data.noDepartment && (
                <div className="table-card mb-4 p-4" style={{ borderRadius: '16px', border: '1px solid rgba(13, 148, 136, 0.15)' }}>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                        <div className="d-flex align-items-center gap-3">
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0d9488, #0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>trending_up</span>
                            </div>
                            <div>
                                <h5 className="mb-0 fw-black" style={{ color: 'var(--mubs-navy)', fontSize: '1.1rem' }}>Department Efficiency</h5>
                                <p className="mb-0 text-muted small">Performance % from task outcomes (Complete=2 pts, Incomplete=1 pt, Not Done=0 pts)</p>
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <label className="text-muted small mb-0">Period:</label>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '120px' }}
                                value={performancePeriod}
                                onChange={(e) => setPerformancePeriod(e.target.value as PerformancePeriod)}
                            >
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                                <option value="quarter">Quarter</option>
                            </select>
                        </div>
                    </div>
                    {performance && (
                        <>
                            <div className="d-flex flex-wrap align-items-center gap-4 mb-4">
                                <div className="text-center p-3 rounded-3" style={{ background: performance.performancePercent != null ? (performance.performancePercent >= 70 ? '#dcfce7' : performance.performancePercent >= 40 ? '#fef3c7' : '#fee2e2') : '#f1f5f9', minWidth: '120px' }}>
                                    <div className="fw-black" style={{ fontSize: '2rem', color: performance.performancePercent != null ? (performance.performancePercent >= 70 ? '#15803d' : performance.performancePercent >= 40 ? '#b45309' : '#dc2626') : '#64748b' }}>
                                        {performance.performancePercent != null ? `${performance.performancePercent}%` : '—'}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '.75rem' }}>Overall</div>
                                </div>
                                <div className="text-muted small">
                                    Points: <strong>{performance.totalPoints}</strong> / {performance.maxPoints} max
                                </div>
                            </div>
                            {performance.timeSeries && performance.timeSeries.length > 0 && (
                                <>
                                    <div className="d-flex gap-2 mb-2 flex-wrap" style={{ fontSize: '.7rem' }}>
                                        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }}></span> Complete</span>
                                        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 4, background: '#f59e0b' }}></span> Incomplete</span>
                                        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 4, background: '#dc2626' }}></span> Not Done</span>
                                    </div>
                                    <div className="d-flex align-items-end gap-1 mb-3" style={{ minHeight: '72px' }}>
                                        {performance.timeSeries.map((ts, i) => {
                                            const total = ts.complete + ts.incomplete + ts.notDone;
                                            const maxH = 56;
                                            const scale = total > 0 ? maxH / total : 0;
                                            return (
                                                <div key={i} className="d-flex flex-column align-items-center" style={{ flex: 1, minWidth: 28 }}>
                                                    <div className="d-flex flex-column-reverse w-100 rounded overflow-hidden" style={{ height: maxH }}>
                                                        {ts.complete > 0 && <div style={{ height: ts.complete * scale, background: '#22c55e' }} />}
                                                        {ts.incomplete > 0 && <div style={{ height: ts.incomplete * scale, background: '#f59e0b' }} />}
                                                        {ts.notDone > 0 && <div style={{ height: ts.notDone * scale, background: '#dc2626' }} />}
                                                    </div>
                                                    <span className="mt-1 text-muted" style={{ fontSize: '.6rem' }}>{ts.periodLabel}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="pt-2 border-top" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                        <div className="fw-bold mb-2" style={{ fontSize: '.85rem' }}>Performance % over time</div>
                                        <div className="d-flex align-items-end gap-1" style={{ height: 40 }}>
                                            {performance.timeSeries.map((ts, i) => (
                                                <div key={i} className="flex-fill d-flex flex-column align-items-center" style={{ minWidth: 24 }}>
                                                    <div className="w-100 rounded" style={{ height: Math.max(4, (ts.performancePercent / 100) * 36), background: ts.performancePercent >= 70 ? '#22c55e' : ts.performancePercent >= 40 ? '#f59e0b' : '#dc2626' }} title={`${ts.periodLabel}: ${ts.performancePercent}%`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            {performance.byStaff && performance.byStaff.length > 0 && (
                                <div className="mt-3 pt-3 border-top" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                    <div className="fw-bold mb-2" style={{ fontSize: '.85rem' }}>By staff</div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {performance.byStaff.slice(0, 8).map((s, i) => (
                                            <div key={i} className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded" style={{ background: '#f8fafc', fontSize: '.8rem' }}>
                                                <span className="text-dark fw-semibold text-truncate" style={{ maxWidth: '120px' }}>{s.staffName}</span>
                                                <span className="badge" style={{ background: s.performancePercent >= 70 ? '#dcfce7' : s.performancePercent >= 40 ? '#fef3c7' : '#fee2e2', color: s.performancePercent >= 70 ? '#15803d' : s.performancePercent >= 40 ? '#b45309' : '#dc2626' }}>{s.performancePercent}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {performance?.message && <p className="text-muted small mb-0">{performance.message}</p>}
                </div>
            )}

            <div className="row g-4">
                {/* Quick Actions — premium tiles (like Staff dashboard) */}
                <div className="col-12">
                    <div className="row g-3 mb-1">
                        <div className="col-12 col-sm-6 col-xl-3">
                            <button
                                type="button"
                                className="text-decoration-none h-100 w-100 border-0 bg-transparent p-0"
                                onClick={() => router.push('/department-head?pg=activities')}
                            >
                                <div
                                    className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                                    style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px', textAlign: 'left' }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div
                                        className="icon-box d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 86, 150, 0.1)' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '22px' }}>track_changes</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Strategic activities</div>
                                        <div className="text-muted small" style={{ fontSize: '.78rem' }}>Strategic Plan activities</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <button
                                type="button"
                                className="text-decoration-none h-100 w-100 border-0 bg-transparent p-0"
                                onClick={() => router.push('/department-head?pg=tasks')}
                            >
                                <div
                                    className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                                    style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px', textAlign: 'left' }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div
                                        className="icon-box d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '22px' }}>assignment_turned_in</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Department tasks</div>
                                        <div className="text-muted small" style={{ fontSize: '.78rem' }}>Task Assigned within Department</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <button
                                type="button"
                                className="text-decoration-none h-100 w-100 border-0 bg-transparent p-0"
                                onClick={() => router.push('/department-head?pg=evaluations')}
                            >
                                <div
                                    className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                                    style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px', textAlign: 'left' }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div
                                        className="icon-box d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124, 58, 237, 0.1)' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '22px' }}>rate_review</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="fw-black text-dark text-truncate" style={{ fontSize: '.95rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>Submissions & reviews</div>
                                        <div className="text-muted small text-truncate" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                                            Pending: {stats.pendingSubmissions}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <button
                                type="button"
                                className="text-decoration-none h-100 w-100 border-0 bg-transparent p-0"
                                onClick={() => router.push('/department-head?pg=staff')}
                            >
                                <div
                                    className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                                    style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px', textAlign: 'left' }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div
                                        className="icon-box d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(227, 24, 55, 0.1)' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '22px' }}>warning</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>System warnings</div>
                                        <div className="text-muted small" style={{ fontSize: '.78rem' }}>Active: {stats.hrAlerts}</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Department progress */}
                <div className="col-12 col-lg-8">
                    <div className="table-card mb-4">
                        <div className="table-card-header flex-wrap gap-2">
                            <div>
                                <h5 className="mb-0">
                                    <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>analytics</span>
                                    Strategic activity progress
                                </h5>
                                <div className="text-muted small mt-1">Activities assigned from the institutional strategic plan</div>
                            </div>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push('/department-head?pg=activities')}>View all</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Activity</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityProgress.map((act, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="activity-icon">
                                                        <span className="material-symbols-outlined">
                                                            {act.title.toLowerCase().includes('computer') ? 'computer' :
                                                                act.title.toLowerCase().includes('digital') ? 'laptop' :
                                                                    act.title.toLowerCase().includes('curriculum') ? 'code' : 'school'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '.85rem', maxWidth: '250px' }}>{act.title}</div>
                                                        <div className="text-muted" style={{ fontSize: '.72rem' }}>Due {act.end_date ? new Date(act.end_date).toLocaleDateString() : 'TBD'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="status-badge" style={{
                                                    background:
                                                        act.status === 'On Track' ? '#dcfce7'
                                                        : act.status === 'In Progress' ? '#fef9c3'
                                                        : act.status === 'Delayed' ? '#fee2e2'
                                                        : '#f1f5f9',
                                                    color:
                                                        act.status === 'On Track' ? '#15803d'
                                                        : act.status === 'In Progress' ? '#a16207'
                                                        : act.status === 'Delayed' ? '#b91c1c'
                                                        : '#475569'
                                                }}>{act.status}</span>
                                            </td>
                                            <td style={{ minWidth: '120px' }}>
                                                <div className="progress-bar-custom">
                                                    <div className="progress-bar-fill" style={{
                                                        width: `${act.progress}%`,
                                                        background: act.progress >= 75 ? '#10b981' : (act.progress >= 40 ? '#005696' : '#e31837')
                                                    }}></div>
                                                </div>
                                                <span style={{ fontSize: '.72rem', color: '#64748b' }}>{act.progress}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="table-card mb-4">
                        <div className="table-card-header flex-wrap gap-2">
                            <div>
                                <h5 className="mb-0">
                                    <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-navy)' }}>apartment</span>
                                    Department tasks
                                </h5>
                                <div className="text-muted small mt-1">Operational tasks not linked to the strategic plan</div>
                            </div>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push('/department-head?pg=departmental-activities')}>View all</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Task / activity</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departmentalProgress.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center text-muted py-4 small">No departmental tasks yet.</td>
                                        </tr>
                                    ) : (
                                        departmentalProgress.map((act, index) => (
                                            <tr key={`dept-${index}`}>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="activity-icon">
                                                            <span className="material-symbols-outlined">apartment</span>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '.85rem', maxWidth: '250px' }}>{act.title}</div>
                                                            <div className="text-muted" style={{ fontSize: '.72rem' }}>Due {act.end_date ? new Date(act.end_date).toLocaleDateString() : 'TBD'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="status-badge" style={{
                                                        background:
                                                            act.status === 'On Track' ? '#dcfce7'
                                                            : act.status === 'In Progress' ? '#fef9c3'
                                                            : act.status === 'Delayed' ? '#fee2e2'
                                                            : '#f1f5f9',
                                                        color:
                                                            act.status === 'On Track' ? '#15803d'
                                                            : act.status === 'In Progress' ? '#a16207'
                                                            : act.status === 'Delayed' ? '#b91c1c'
                                                            : '#475569'
                                                    }}>{act.status}</span>
                                                </td>
                                                <td style={{ minWidth: '120px' }}>
                                                    <div className="progress-bar-custom">
                                                        <div className="progress-bar-fill" style={{
                                                            width: `${act.progress}%`,
                                                            background: act.progress >= 75 ? '#10b981' : (act.progress >= 40 ? '#005696' : '#e31837')
                                                        }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '.72rem', color: '#64748b' }}>{act.progress}%</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* Right column */}
                <div className="col-12 col-lg-4 d-flex flex-column gap-4">
                    {/* Recent Submissions (sidebar / compact) */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5 className="mb-0">
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>inbox</span>
                                Recent Submissions
                            </h5>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push('/department-head?pg=evaluations')}>View All</button>
                        </div>
                        <div className="p-3">
                            {recentSubmissions.length === 0 ? (
                                <div className="text-muted small text-center py-3">No submissions yet.</div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {recentSubmissions.slice(0, 6).map((sub, index) => (
                                        <div key={index} className="p-3 rounded-4 border bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                            <div className="d-flex align-items-start justify-content-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '.85rem' }}>{sub.staff}</div>
                                                    <div className="text-muted text-truncate" style={{ fontSize: '.78rem' }}>{sub.task}</div>
                                                </div>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: sub.status === 'Reviewed' ? '#dcfce7' : '#fef9c3',
                                                        color: sub.status === 'Reviewed' ? '#15803d' : '#a16207',
                                                        fontSize: '.72rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {sub.status}
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between mt-2">
                                                <div style={{ fontSize: '.72rem', color: '#64748b' }}>{sub.date}</div>
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-primary py-0 px-2 fw-bold"
                                                    style={{ fontSize: '.75rem', background: 'var(--mubs-blue)' }}
                                                    onClick={() => router.push(sub.status === 'Reviewed' ? '/department-head?pg=evaluations' : '/department-head?pg=submissions')}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{sub.status === 'Reviewed' ? 'visibility' : 'rate_review'}</span>
                                                    {sub.status === 'Reviewed' ? ' View' : ' Review'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
