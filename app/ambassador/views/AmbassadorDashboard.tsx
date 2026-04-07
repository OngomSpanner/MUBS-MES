'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import ComplianceGrid from '@/components/Tracking/ComplianceGrid';

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
    subUnits: Array<{
        id: number;
        name: string;
        progress: number;
        activityCount: number;
    }>;
    riskAlerts: Array<{
        id: number;
        title: string;
        department: string;
        status: string;
        progress: number;
        dueDate: string | null;
    }>;
    complianceGrid: {
        months: string[];
        grid: any[];
    };
}

export default function AmbassadorDashboard() {
    const [data, setData] = useState<AmbassadorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/ambassador');
                const complianceResponse = await axios.get('/api/ambassador/compliance');
                
                setData({
                    ...response.data,
                    complianceGrid: complianceResponse.data
                });
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
        <div className="page-section active-page">
            {/* Faculty Hero Banner */}
            <div className="kpi-hero mb-4" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-auto text-center text-md-start">
                        <div className="kpi-hero-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span> Strategic Plan Ambassador · {managedUnitName}
                        </div>
                        <div className="d-flex align-items-end gap-3 flex-wrap justify-content-center justify-content-md-start">
                            <div>
                                <div className="kpi-hero-value">{stats.overallProgress}<span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span></div>
                                <div className="kpi-hero-label">Faculty Strategic Progress</div>
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
                                <div className="kpi-hero-label">Area Activities</div>
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

            {/* Quick Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="apartment"
                        label="Departments Oversaw"
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

            <div className="row g-4">
                {/* Department Roster */}
                <div className="col-12 col-lg-8">
                    <div className="table-card h-100 shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3">
                            <h5 className="mb-0 d-flex align-items-center gap-2 px-3">
                                <span className="material-symbols-outlined text-primary">groups_2</span>
                                Departmental Progress Roster
                            </h5>
                        </div>
                        <div className="table-responsive p-3">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ fontSize: '.75rem', fontWeight: 800 }}>DEPARTMENT / UNIT</th>
                                        <th style={{ fontSize: '.75rem', fontWeight: 800 }} className="text-center">ACTIVITIES</th>
                                        <th style={{ fontSize: '.75rem', fontWeight: 800 }}>PROGRESS</th>
                                        <th style={{ fontSize: '.75rem', fontWeight: 800 }}>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subUnits.map((unit) => (
                                        <tr key={unit.id} className="cursor-pointer">
                                            <td>
                                                <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>{unit.name}</div>
                                                <div className="text-muted" style={{ fontSize: '.7rem' }}>ID: {unit.id}</div>
                                            </td>
                                            <td className="text-center">
                                                <span className="badge bg-light text-dark border">{unit.activityCount}</span>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="progress flex-fill" style={{ height: '8px', borderRadius: '4px', background: '#e2e8f0', minWidth: '100px' }}>
                                                        <div 
                                                            className="progress-bar progress-bar-striped progress-bar-animated" 
                                                            style={{ 
                                                                width: `${unit.progress}%`,
                                                                background: unit.progress >= 75 ? '#10b981' : unit.progress >= 50 ? '#f59e0b' : '#ef4444'
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span className="fw-bold" style={{ fontSize: '.8rem', minWidth: '35px' }}>{unit.progress}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span 
                                                    className="status-badge" 
                                                    style={{ 
                                                        background: unit.progress >= 75 ? '#dcfce7' : unit.progress >= 50 ? '#fef3c7' : '#fee2e2',
                                                        color: unit.progress >= 75 ? '#15803d' : unit.progress >= 50 ? '#b45309' : '#b91c1c',
                                                        fontSize: '.7rem',
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontWeight: 800
                                                    }}
                                                >
                                                    {unit.progress >= 75 ? 'On Track' : unit.progress >= 50 ? 'Warning' : 'Critical'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Risks and Flags */}
                <div className="col-12 col-lg-4">
                    <div className="table-card h-100 shadow-sm border-0">
                        <div className="table-card-header bg-white border-bottom py-3">
                            <h5 className="mb-0 d-flex align-items-center gap-2 px-3">
                                <span className="material-symbols-outlined text-danger">report</span>
                                Faculty Risk Benching
                            </h5>
                        </div>
                        <div className="p-3">
                            {riskAlerts.length > 0 ? (
                                <div className="d-flex flex-column gap-3">
                                    {riskAlerts.map((risk) => (
                                        <div key={risk.id} className="p-3 rounded-3 border-start border-4" style={{ 
                                            background: risk.status === 'Critical' ? '#fff5f5' : '#fffbeb',
                                            borderColor: risk.status === 'Critical' ? '#ef4444' : '#f59e0b'
                                        }}>
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <span className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{risk.title}</span>
                                                <span className={`badge ${risk.status === 'Critical' ? 'bg-danger' : 'bg-warning text-dark'}`} style={{ fontSize: '.6rem' }}>{risk.status}</span>
                                            </div>
                                            <div className="text-muted mb-2" style={{ fontSize: '.75rem' }}>
                                                {risk.department}
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-fill" style={{ height: '4px' }}>
                                                    <div className="progress-bar" style={{ width: `${risk.progress}%`, background: risk.status === 'Critical' ? '#ef4444' : '#f59e0b' }}></div>
                                                </div>
                                                <span className="small fw-bold">{risk.progress}%</span>
                                            </div>
                                            {risk.dueDate && (
                                                <div className="mt-2 text-danger fw-bold d-flex align-items-center gap-1" style={{ fontSize: '.65rem' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                                                    Due: {new Date(risk.dueDate).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '48px' }}>check_circle</span>
                                    <p className="small mb-0">No active risks detected in your faculty.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Compliance Heatmap Grid */}
            <div className="row mt-4">
                <div className="col-12">
                   {data?.complianceGrid && (
                    <ComplianceGrid 
                        months={data.complianceGrid.months}
                        grid={data.complianceGrid.grid}
                        loading={loading}
                        title="Faculty Submission Heatmap"
                    />
                   )}
                </div>
            </div>
        </div>
    );
}
