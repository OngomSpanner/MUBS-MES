'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DepartmentActivity {
    id: number;
    title: string;
    progress: number;
    status: string;
    pillar: string;
}

interface DepartmentRisk {
    id: number;
    title: string;
    description: string;
    end_date: string;
    daysLeft: number;
}

interface DepartmentDrillDown {
    id: number;
    name: string;
    head: string;
    activitiesCount: number;
    overallProgress: number;
    completedCount: number;
    inProgressCount: number;
    delayedCount: number;
    recentActivities: DepartmentActivity[];
    risks: DepartmentRisk[];
}

interface StrategicSummaryData {
    stats: {
        totalActivities: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
    };
    departments: DepartmentDrillDown[];
}

export default function StrategicSummary() {
    const [data, setData] = useState<StrategicSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
    const [pillarFilter, setPillarFilter] = useState('All Pillars');
    const [statusFilter, setStatusFilter] = useState('All Statuses');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/principal/strategic-summary');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching strategic summary data:', error);
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

    const toggleUnit = (id: number) => {
        setExpandedUnit(expandedUnit === id ? null : id);
    };

    const getPerformanceLabel = (progress: number) => {
        if (progress >= 85) return { label: 'Excellent', bg: '#dcfce7', color: '#15803d' };
        if (progress >= 70) return { label: 'Good', bg: '#fef9c3', color: '#a16207' };
        if (progress >= 50) return { label: 'Fair', bg: '#fde8d8', color: '#c2410c' };
        return { label: 'Critical', bg: '#fee2e2', color: '#b91c1c' };
    };

    return (
        <div id="page-strategic" className="page-section active-page">
            <div className="alert alert-primary alert-strip alert-dismissible fade show mb-4 d-flex align-items-center gap-2" role="alert" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--mubs-blue)' }}>info</span>
                <div>You are viewing a <strong>live snapshot</strong> of the institutional strategic plan. Click any department row to drill down.</div>
                <button type="button" className="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>

            {/* Summary stats */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-blue)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900 }}>{data.stats.totalActivities}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">Total Activities</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid #10b981', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669' }}>{data.stats.onTrack}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">On Track</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-yellow)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{data.stats.inProgress}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">In Progress</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-red)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--mubs-red)' }}>{data.stats.delayed}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">Delayed</div>
                    </div>
                </div>
            </div>

            {/* Drill-down by department */}
            <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center" style={{ fontSize: '1rem' }}>
                    <span className="material-symbols-outlined me-2 text-primary" style={{ fontSize: '20px' }}>corporate_fare</span>
                    Institutional Drill-Down — Click to Expand
                </h6>
                <div className="d-flex gap-2">
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '150px', fontSize: '.8rem' }}
                        value={pillarFilter}
                        onChange={(e) => setPillarFilter(e.target.value)}
                    >
                        <option>All Pillars</option>
                        <option>Teaching & Learning</option>
                        <option>Research & Innovation</option>
                        <option>Governance</option>
                        <option>Infrastructure</option>
                        <option>Partnerships</option>
                    </select>
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '130px', fontSize: '.8rem' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option>All Statuses</option>
                        <option>On Track</option>
                        <option>Delayed</option>
                    </select>
                </div>
            </div>

            {/* Department rows */}
            <div className="d-flex flex-column gap-3">
                {data.departments.map((department) => {
                    const perf = getPerformanceLabel(department.overallProgress);
                    return (
                        <div
                            key={department.id}
                            className={`department-drill-row bg-white p-3 rounded-3 shadow-sm border ${expandedUnit === department.id ? 'border-primary' : ''}`}
                            onClick={() => toggleUnit(department.id)}
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                        >
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-3">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>corporate_fare</span>
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.92rem' }}>{department.name}</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>{department.activitiesCount} activities · {department.head || 'No Department Head Assigned'}</div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    <div className="text-center">
                                        <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{department.overallProgress}%</div>
                                        <div style={{ fontSize: '.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Progress</div>
                                    </div>
                                    <div className="text-center">
                                        <span className="status-badge" style={{ background: perf.bg, color: perf.color, padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '.68rem' }}>{perf.label}</span>
                                    </div>
                                    <span className="material-symbols-outlined text-muted" style={{ fontSize: '20px', transition: 'transform 0.2s ease', transform: expandedUnit === department.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        expand_more
                                    </span>
                                </div>
                            </div>

                            {expandedUnit === department.id && (
                                <div className="department-drill-detail mt-3 pt-3 border-top border-light">
                                    <div className="row g-3">
                                        <div className="col-sm-4">
                                            <div className="p-3 rounded-3 text-center" style={{ background: '#f8fafc' }}>
                                                <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{department.completedCount}</div>
                                                <div className="text-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Completed</div>
                                            </div>
                                        </div>
                                        <div className="col-sm-4">
                                            <div className="p-3 rounded-3 text-center" style={{ background: '#f8fafc' }}>
                                                <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{department.inProgressCount}</div>
                                                <div className="text-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 700 }}>In Progress</div>
                                            </div>
                                        </div>
                                        <div className="col-sm-4">
                                            <div className="p-3 rounded-3 text-center" style={{ background: '#f8fafc' }}>
                                                <div className={`fw-bold ${department.delayedCount > 0 ? 'text-danger' : 'text-success'}`} style={{ fontSize: '1.1rem' }}>{department.delayedCount}</div>
                                                <div className="text-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Delayed</div>
                                            </div>
                                        </div>
                                    </div>

                                    {department.risks.length > 0 && (
                                        <div className="mt-3">
                                            <div className="fw-bold text-danger mb-2 d-flex align-items-center gap-1" style={{ fontSize: '.83rem' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>warning</span> Risk Areas
                                            </div>
                                            <div className="d-flex flex-column gap-2">
                                                {department.risks.map(risk => (
                                                    <div key={risk.id} className="d-flex align-items-start gap-2 p-2 rounded" style={{ background: '#fff1f2', borderLeft: '3px solid #e31837' }}>
                                                        <div style={{ fontSize: '.8rem', color: '#450a0a' }}><strong>{risk.title}</strong> — {risk.description || 'No additional details provided.'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-3">
                                        <div className="fw-bold text-dark mb-2" style={{ fontSize: '.83rem' }}>Recent Activities</div>
                                        <div className="d-flex flex-column gap-2">
                                            {department.recentActivities.length > 0 ? department.recentActivities.map(act => (
                                                <div key={act.id} className="d-flex align-items-center gap-3 p-2 rounded-3 hover-bg-light" style={{ transition: 'background 0.2s' }}>
                                                    <div className="activity-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>flag</span>
                                                    </div>
                                                    <div className="flex-fill">
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <div style={{ fontSize: '.83rem', fontWeight: 600, color: '#0f172a' }}>{act.title}</div>
                                                            <div className="progress" style={{ width: '80px', height: '4px', borderRadius: '2px' }}>
                                                                <div className="progress-bar bg-success" style={{ width: `${act.progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '.72rem', color: '#64748b' }}>{act.pillar} · {act.progress}% complete · {act.status}</div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-muted small text-center py-2 italic">No recent activities found for this department.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
