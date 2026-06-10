'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import StatCard from '@/components/StatCard';

const quickActionHover = {
    onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
    },
    onMouseOut: (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    },
};

interface AmbassadorData {
    managedUnitName: string;
    stats: {
        totalActivities: number;
        overallProgress: number;
        complianceRate: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
        totalUnits: number;
    };
    subUnits: Array<{ id: number; name: string; progress: number; activityCount: number }>;
    riskAlerts: Array<{ id: number; title: string; department: string; status: string; progress: number; dueDate: string | null }>;
}

export default function AmbassadorDashboard() {
    const [data, setData] = useState<AmbassadorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/ambassador');
                setData(response.data);
            } catch (err: any) {
                console.error('Error fetching ambassador data:', err);
                setError(err.response?.data?.message || 'Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <h6 className="mb-0 fw-bold">Dashboard Error</h6>
                        <p className="mb-0 small">{error || 'Unable to load dashboard. Please contact the administrator.'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const { managedUnitName, stats, subUnits, riskAlerts } = data;

    return (
        <div id="page-dashboard" className="page-section active-page">
            {/* Hero banner */}
            <div className="kpi-hero mb-4">
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-auto text-center text-md-start">
                        <div className="kpi-hero-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
                            Strategic Plan Ambassador · {managedUnitName}
                        </div>
                        <div className="d-flex align-items-end gap-3 flex-wrap justify-content-center justify-content-md-start">
                            <div>
                                <div className="kpi-hero-value">
                                    {stats.overallProgress}
                                    <span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span>
                                </div>
                                <div className="kpi-hero-label">Dept. / Unit Strategic Progress</div>
                                <div
                                    className="progress mt-2"
                                    style={{
                                        height: '8px',
                                        background: 'rgba(255,255,255,0.15)',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        className="progress-bar"
                                        style={{
                                            width: `${stats.overallProgress}%`,
                                            background: 'linear-gradient(90deg, #60a5fa, var(--mubs-blue))',
                                            boxShadow: '0 0 10px rgba(96, 165, 250, 0.5)',
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block" />
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{stats.totalActivities}</div>
                                <div className="kpi-hero-label">Area Activities</div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block" />
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>
                                    {stats.complianceRate}
                                    <span style={{ fontSize: '1.2rem' }}>%</span>
                                </div>
                                <div className="kpi-hero-label">Compliance Rate</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md ms-md-auto">
                        <div className="row g-3 text-white">
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4ade80' }}>{stats.onTrack}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#86efac', textTransform: 'uppercase' }}>On Track</div>
                            </div>
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{stats.inProgress}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#fde68a', textTransform: 'uppercase' }}>In Progress</div>
                            </div>
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fca5a5' }}>{stats.delayed}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase' }}>Delayed</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="apartment"
                        label="Departments Overseen"
                        value={stats.totalUnits}
                        badge="Units"
                        badgeIcon="business"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="crisis_alert"
                        label="Area Risk Alerts"
                        value={riskAlerts.length}
                        badge={riskAlerts.length > 0 ? 'Critical' : 'Clear'}
                        badgeIcon="notifications_active"
                        color={riskAlerts.length > 0 ? 'red' : 'green'}
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="fact_check"
                        label="Compliance"
                        value={`${stats.complianceRate}%`}
                        badge="Average"
                        badgeIcon="monitoring"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="speed"
                        label="Managed Units"
                        value={subUnits.length}
                        badge="Active"
                        badgeIcon="check_circle"
                        color="green"
                    />
                </div>
            </div>

            {/* Quick actions */}
            <div className="row g-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=reports&tab=compliance" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 86, 150, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '22px' }}>bar_chart</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Unit reports</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Department activities & reporting</div>
                            </div>
                        </div>
                    </Link>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=reports&tab=compliance" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '22px' }}>fact_check</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Dept. compliance tracker</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Monitor activities & submissions</div>
                            </div>
                        </div>
                    </Link>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=reports&tab=benefits" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124, 58, 237, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '22px' }}>apartment</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Managed departments</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>{stats.totalUnits} units under oversight</div>
                            </div>
                        </div>
                    </Link>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=reports&tab=recruitment" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(227, 24, 55, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '22px' }}>warning</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Risk alerts</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>
                                    {riskAlerts.length > 0 ? `${riskAlerts.length} active alerts` : 'No active alerts'}
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
