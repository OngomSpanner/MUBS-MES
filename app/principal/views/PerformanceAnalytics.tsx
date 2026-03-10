'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DepartmentPerformance {
    label: string;
    value: number;
}

interface StaffPerformance {
    name: string;
    department: string;
    totalActivities: number;
    completed: number;
    rate: number;
}

interface AnalyticsData {
    departmentPerformance: DepartmentPerformance[];
    institutionAverage: number;
    statusSplit: Array<{ status: string; count: number }>;
    complianceDistribution: {
        compliant: number;
        watch: number;
        critical: number;
    };
    staffPerformance: StaffPerformance[];
}

export default function PerformanceAnalytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'department' | 'compliance' | 'staff'>('department');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/principal/analytics');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching analytics data:', error);
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

    const { departmentPerformance, institutionAverage, statusSplit, complianceDistribution, staffPerformance } = data;

    const totalActivities = statusSplit.reduce((acc, curr) => acc + curr.count, 0) || 1;
    const onTrackCount = statusSplit.find(s => s.status === 'On Track')?.count || 0;
    const completedCount = statusSplit.find(s => s.status === 'Completed')?.count || 0;
    const inProgressCount = statusSplit.find(s => s.status === 'In Progress')?.count || 0;
    const delayedCount = statusSplit.find(s => s.status === 'Delayed')?.count || 0;

    const onTrackPct = Math.round(((onTrackCount + completedCount) / totalActivities) * 100);
    const inProgressPct = Math.round((inProgressCount / totalActivities) * 100);
    const delayedPct = Math.round((delayedCount / totalActivities) * 100);

    return (
        <div id="page-analytics" className="page-section active-page">
            {/* Tabs */}
            <ul className="nav nav-pills mb-4 gap-2" id="analyticsTab">
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold ${activeTab === 'department' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'department' ? 'var(--mubs-blue)' : 'rgba(255,255,255,.05)',
                            color: activeTab === 'department' ? '#fff' : '#475569',
                            borderRadius: '8px',
                            fontSize: '.83rem'
                        }}
                        onClick={() => setActiveTab('department')}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>corporate_fare</span>Department Comparison
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold ${activeTab === 'compliance' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'compliance' ? 'var(--mubs-blue)' : 'rgba(255,255,255,.05)',
                            color: activeTab === 'compliance' ? '#fff' : '#475569',
                            borderRadius: '8px',
                            fontSize: '.83rem'
                        }}
                        onClick={() => setActiveTab('compliance')}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>fact_check</span>Compliance
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold ${activeTab === 'staff' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'staff' ? 'var(--mubs-blue)' : 'rgba(255,255,255,.05)',
                            color: activeTab === 'staff' ? '#fff' : '#475569',
                            borderRadius: '8px',
                            fontSize: '.83rem'
                        }}
                        onClick={() => setActiveTab('staff')}
                    >
                        <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>person_search</span>Staff Performance
                    </button>
                </li>
            </ul>

            {/* Tab 1: Department Comparison */}
            {activeTab === 'department' && (
                <div id="tab-department" className="analytics-tab">
                    <div className="row g-4">
                        <div className="col-12 col-lg-8">
                            <div className="table-card bg-white rounded-3 shadow-sm border p-0">
                                <div className="p-4 border-bottom d-flex align-items-center justify-content-between">
                                    <h5 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                                        <span className="material-symbols-outlined text-primary">bar_chart</span>
                                        Department Performance Comparison
                                    </h5>
                                </div>
                                <div className="p-4">
                                    {departmentPerformance.map((department, idx) => (
                                        <div key={idx} className="mb-3">
                                            <div className="d-flex justify-content-between mb-1">
                                                <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#334155' }}>{department.label}</span>
                                                <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#1e293b' }}>{department.value}%</span>
                                            </div>
                                            <div className="progress" style={{ height: '10px', borderRadius: '5px', background: '#f1f5f9' }}>
                                                <div className="progress-bar" style={{
                                                    width: `${department.value}%`,
                                                    background: department.value >= 75 ? '#10b981' : (department.value >= 50 ? '#ffcd00' : '#ef4444'),
                                                    borderRadius: '5px'
                                                }}></div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="mt-4 pt-3 border-top">
                                        <div className="d-flex align-items-center justify-content-between">
                                            <span style={{ fontSize: '.85rem', color: '#64748b', fontWeight: 700 }}>Institution Average</span>
                                            <span className="fw-bold" style={{ color: 'var(--mubs-blue)', fontSize: '1.1rem' }}>{institutionAverage}%</span>
                                        </div>
                                        <div className="progress mt-2" style={{ height: '6px', borderRadius: '3px', background: '#f1f5f9' }}>
                                            <div className="progress-bar" style={{ width: `${institutionAverage}%`, background: 'var(--mubs-blue)' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-lg-4 d-flex flex-column gap-4">
                            <div className="table-card bg-white rounded-3 shadow-sm border p-4">
                                <h5 className="mb-3" style={{ fontSize: '.9rem', fontWeight: 800 }}>Activity Status Split</h5>
                                <div className="d-flex align-items-center justify-content-center position-relative mb-4" style={{ height: '150px' }}>
                                    <svg width="130" height="130" viewBox="0 0 130 130">
                                        <circle cx="65" cy="65" r="52" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                                        {/* On track */}
                                        <circle cx="65" cy="65" r="52" fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray={`${(onTrackPct / 100) * 326.7} 326.7`} strokeLinecap="round" />
                                        {/* In Progress */}
                                        <circle cx="65" cy="65" r="52" fill="none" stroke="#ffcd00" strokeWidth="14" strokeDasharray={`${(inProgressPct / 100) * 326.7} 326.7`} strokeDashoffset={`${-((onTrackPct / 100) * 326.7)}`} strokeLinecap="round" />
                                        {/* Delayed */}
                                        <circle cx="65" cy="65" r="52" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray={`${(delayedPct / 100) * 326.7} 326.7`} strokeDashoffset={`${-(((onTrackPct + inProgressPct) / 100) * 326.7)}`} strokeLinecap="round" />
                                    </svg>
                                    <div className="position-absolute text-center">
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>{totalActivities}</div>
                                        <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Items</div>
                                    </div>
                                </div>
                                <div className="d-flex flex-column gap-2">
                                    <div className="d-flex align-items-center justify-content-between p-2 rounded-2" style={{ background: '#f0fdf4' }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                                            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#166534' }}>On Track / Done</span>
                                        </div>
                                        <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#166534' }}>{onTrackCount + completedCount}</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between p-2 rounded-2" style={{ background: '#fffbeb' }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffcd00' }}></div>
                                            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#92400e' }}>In Progress</span>
                                        </div>
                                        <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#92400e' }}>{inProgressCount}</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between p-2 rounded-2" style={{ background: '#fef2f2' }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                                            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#991b1b' }}>Delayed</span>
                                        </div>
                                        <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#991b1b' }}>{delayedCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Compliance */}
            {activeTab === 'compliance' && (
                <div id="tab-compliance" className="analytics-tab">
                    <div className="row g-4">
                        <div className="col-12 col-lg-8">
                            <div className="table-card bg-white rounded-3 shadow-sm border p-0">
                                <div className="p-4 border-bottom d-flex align-items-center justify-content-between">
                                    <h5 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1rem', fontWeight: 800 }}>
                                        <span className="material-symbols-outlined text-primary">fact_check</span>
                                        Compliance Distribution
                                    </h5>
                                    <span className="badge p-2 px-3" style={{ background: '#fef9c3', color: '#a16207', fontWeight: 800 }}>Target: 85%</span>
                                </div>
                                <div className="p-4 d-flex flex-column gap-4">
                                    <div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#059669' }}>≥75% — Compliant Departments</span>
                                            <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#059669' }}>{complianceDistribution.compliant}</span>
                                        </div>
                                        <div className="progress" style={{ height: '12px', borderRadius: '6px', background: '#f1f5f9' }}>
                                            <div className="progress-bar" style={{ width: `${(complianceDistribution.compliant / (departmentPerformance.length || 1)) * 100}%`, background: '#10b981' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#a16207' }}>50–74% — Watchlist Departments</span>
                                            <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#a16207' }}>{complianceDistribution.watch}</span>
                                        </div>
                                        <div className="progress" style={{ height: '12px', borderRadius: '6px', background: '#f1f5f9' }}>
                                            <div className="progress-bar" style={{ width: `${(complianceDistribution.watch / (departmentPerformance.length || 1)) * 100}%`, background: '#ffcd00' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#b91c1c' }}>&lt;50% — Critical Departments</span>
                                            <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#b91c1c' }}>{complianceDistribution.critical}</span>
                                        </div>
                                        <div className="progress" style={{ height: '12px', borderRadius: '6px', background: '#f1f5f9' }}>
                                            <div className="progress-bar" style={{ width: `${(complianceDistribution.critical / (departmentPerformance.length || 1)) * 100}%`, background: '#ef4444' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-lg-4">
                            <div className="table-card bg-white rounded-3 shadow-sm border p-4 text-center">
                                <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--mubs-blue)' }}>{institutionAverage}%</div>
                                <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '.1em' }}>Institutional Compliance</div>
                                <div className="progress mt-4 mb-2" style={{ height: '8px', borderRadius: '4px' }}>
                                    <div className="progress-bar" style={{ width: `${institutionAverage}%`, background: 'var(--mubs-blue)' }}></div>
                                </div>
                                <div className="text-muted small">Based on {departmentPerformance.length} departments</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Staff Performance */}
            {activeTab === 'staff' && (
                <div id="tab-staff" className="analytics-tab">
                    <div className="table-card bg-white rounded-3 shadow-sm border p-0 overflow-hidden">
                        <div className="p-4 border-bottom d-flex align-items-center justify-content-between">
                            <h5 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1rem', fontWeight: 800 }}>
                                <span className="material-symbols-outlined text-primary">person_search</span>
                                Staff Performance Summaries
                            </h5>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="p-3 border-0" style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Staff Member</th>
                                        <th className="p-3 border-0" style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Department</th>
                                        <th className="p-3 border-0" style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Activities</th>
                                        <th className="p-3 border-0" style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Rate</th>
                                        <th className="p-3 border-0" style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffPerformance.map((staff, idx) => {
                                        const rating = staff.rate >= 85 ? 'Excellent' : (staff.rate >= 70 ? 'Good' : (staff.rate >= 50 ? 'Fair' : 'Needs Improvement'));
                                        const ratingColor = staff.rate >= 85 ? '#10b981' : (staff.rate >= 70 ? '#22c55e' : (staff.rate >= 50 ? '#ffcd00' : '#ef4444'));
                                        const ratingBg = staff.rate >= 85 ? '#f0fdf4' : (staff.rate >= 70 ? '#f0fdf4' : (staff.rate >= 50 ? '#fffbeb' : '#fef2f2'));

                                        return (
                                            <tr key={idx}>
                                                <td className="p-3 border-light">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>person</span>
                                                        </div>
                                                        <span style={{ fontSize: '.88rem', fontWeight: 700, color: '#1e293b' }}>{staff.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 border-light text-muted" style={{ fontSize: '.85rem' }}>{staff.department}</td>
                                                <td className="p-3 border-light fw-bold" style={{ fontSize: '.85rem' }}>{staff.completed}/{staff.totalActivities}</td>
                                                <td className="p-3 border-light">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="progress flex-fill" style={{ height: '6px', width: '80px', borderRadius: '3px', background: '#f1f5f9' }}>
                                                            <div className="progress-bar" style={{ width: `${staff.rate}%`, background: ratingColor }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '.8rem', fontWeight: 800 }}>{staff.rate}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 border-light">
                                                    <span className="badge" style={{ background: ratingBg, color: ratingColor, fontWeight: 800, fontSize: '.68rem', padding: '5px 10px', borderRadius: '6px' }}>{rating}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
