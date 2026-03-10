'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface PrincipalData {
    stats: {
        totalActivities: number;
        overallProgress: number;
        complianceRate: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
        totalUnits: number;
        riskAlerts: number;
        activeStaff: number;
    };
    complianceByUnit: Array<{ department: string; progress: number }>;
    riskAlerts: Array<{ id: number; title: string; department: string; daysPast?: number; daysLeft?: number; progress: number; status: string }>;
    overdueActivities: Array<{ id: number; title: string; department: string; daysOverdue: number; progress: number }>;
}

export default function ExecutiveOverview() {
    const [data, setData] = useState<PrincipalData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/principal');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching principal dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const { stats, complianceByUnit, riskAlerts, overdueActivities } = data;

    return (
        <div id="page-overview" className="page-section active-page">
            {/* KPI Hero Banner */}
            <div className="kpi-hero mb-4">
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-auto text-center text-md-start">
                        <div className="kpi-hero-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span> Institutional Overview · FY 2024–25
                        </div>
                        <div className="d-flex align-items-end gap-3 flex-wrap justify-content-center justify-content-md-start">
                            <div>
                                <div className="kpi-hero-value">{stats.overallProgress}<span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span></div>
                                <div className="kpi-hero-label">Overall Strategic Progress</div>
                                <div className="progress mt-2" style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                    <div className="progress-bar" style={{
                                        width: `${stats.overallProgress}%`,
                                        background: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                                        boxShadow: '0 0 10px rgba(96, 165, 250, 0.5)'
                                    }}></div>
                                </div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block"></div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{stats.totalActivities}</div>
                                <div className="kpi-hero-label">Total Activities</div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block"></div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{stats.complianceRate}<span style={{ fontSize: '1.2rem' }}>%</span></div>
                                <div className="kpi-hero-label">Compliance Rate</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md ms-md-auto">
                        <div className="row g-3 text-white">
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80' }}>{stats.onTrack}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '.08em' }}>On Track</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{stats.inProgress}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '.08em' }}>In Progress</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fca5a5' }}>{stats.delayed}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '.08em' }}>Delayed</div>
                            </div>
                            <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-center">
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c4b5fd' }}>{stats.totalUnits}</div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.08em' }}>Departments</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="verified_user"
                        label="Compliance Rate"
                        value={`${stats.complianceRate}%`}
                        badge="Live"
                        badgeIcon="check_circle"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="running_with_errors"
                        label="Delayed Activities"
                        value={stats.delayed}
                        badge={stats.delayed > 0 ? "Needs Attention" : "Clear"}
                        badgeIcon={stats.delayed > 0 ? "warning" : "check"}
                        color="red"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="crisis_alert"
                        label="Risk Alerts"
                        value={stats.riskAlerts}
                        badge="Active"
                        badgeIcon="notifications_active"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="groups"
                        label="Active Staff"
                        value={stats.activeStaff}
                        badge="Staff"
                        badgeIcon="person"
                        color="blue"
                    />
                </div>
            </div>

            <div className="row g-4">
                {/* Risk Alerts Panel */}
                <div className="col-12 col-lg-5">
                    <div className="table-card h-100">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>crisis_alert</span>Active Risk Alerts</h5>
                            <span className="badge" style={{ background: 'var(--mubs-red)', fontSize: '.72rem' }}>{riskAlerts.length} Open</span>
                        </div>
                        <div className="p-3">
                            {riskAlerts.length > 0 ? riskAlerts.map((risk, index) => (
                                <div key={index} className="risk-item" style={{
                                    background: risk.status === 'Critical' ? '#fff1f2' : '#fffbeb',
                                    borderLeft: `4px solid ${risk.status === 'Critical' ? '#e31837' : '#ffcd00'}`,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    <div className="risk-dot" style={{ background: risk.status === 'Critical' ? '#e31837' : '#ffcd00', width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                    <div className="flex-fill overflow-hidden">
                                        <div className="risk-title text-dark fw-bold" style={{ fontSize: '.85rem' }}>{risk.title}</div>
                                        <div className="risk-meta text-muted" style={{ fontSize: '.72rem' }}>
                                            {risk.department} · {risk.daysPast ? `${risk.daysPast} days overdue` : `${risk.daysLeft} days left`} · {risk.progress}% complete
                                        </div>
                                        <span className="status-badge mt-1" style={{
                                            background: risk.status === 'Critical' ? '#fee2e2' : '#fef9c3',
                                            color: risk.status === 'Critical' ? '#b91c1c' : '#a16207',
                                            fontSize: '.62rem',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        }}>{risk.status}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center p-4 text-muted border border-dashed rounded">No active risk alerts.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Compliance & Institutional health */}
                <div className="col-12 col-lg-7">
                    <div className="table-card mb-4">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>fact_check</span>Compliance by Department</h5>
                        </div>
                        <div className="p-4">
                            {complianceByUnit.map((department, index) => (
                                <div key={index} className="compare-bar-wrap mb-3">
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="compare-bar-label fw-bold" style={{ fontSize: '.8rem' }}>{department.department}</span>
                                        <span className="compare-bar-pct fw-bold text-dark" style={{ fontSize: '.83rem' }}>{department.progress}%</span>
                                    </div>
                                    <div className="progress" style={{ height: '8px', borderRadius: '4px', background: '#e2e8f0' }}>
                                        <div className="progress-bar" style={{
                                            width: `${department.progress}%`,
                                            background: department.progress >= 75 ? '#10b981' : (department.progress >= 50 ? '#ffcd00' : '#e31837'),
                                            borderRadius: '4px'
                                        }}></div>
                                    </div>
                                </div>
                            ))}
                            <div className="mt-3 pt-3 border-top d-flex gap-3 flex-wrap">
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>≥75% — Compliant</span></div>
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ffcd00' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>50–74% — Watch</span></div>
                                <div className="d-flex align-items-center gap-2"><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e31837' }}></div><span style={{ fontSize: '.75rem', color: '#475569', fontWeight: 600 }}>&lt;50% — Critical</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Quick delayed table */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>schedule</span>Overdue Activities</h5>
                            <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>{overdueActivities.length} Overdue</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead><tr><th style={{ fontSize: '.75rem' }}>Activity</th><th style={{ fontSize: '.75rem' }}>Department</th><th style={{ fontSize: '.75rem' }}>Days Overdue</th><th style={{ fontSize: '.75rem' }}>Progress</th></tr></thead>
                                <tbody>
                                    {overdueActivities.length > 0 ? overdueActivities.map((act, index) => (
                                        <tr key={index}>
                                            <td className="fw-bold text-dark text-truncate" style={{ fontSize: '.83rem', maxWidth: '200px' }}>{act.title}</td>
                                            <td style={{ fontSize: '.8rem' }}>{act.department}</td>
                                            <td><span className="badge bg-danger">+{act.daysOverdue}</span></td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="progress flex-fill" style={{ height: '6px', width: '60px', borderRadius: '3px', background: '#f1f5f9' }}>
                                                        <div className="progress-bar" style={{ width: `${act.progress}%`, background: '#e31837' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '.73rem', fontWeight: 700, color: '#64748b' }}>{act.progress}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="text-center p-3 text-muted">No overdue activities found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
