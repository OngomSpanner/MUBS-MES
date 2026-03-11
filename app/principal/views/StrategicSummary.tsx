'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { STRATEGIC_PILLARS_2025_2030 } from '@/lib/strategic-plan';

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
    parent_id: number | null;
    unit_type: string | null;
    name: string;
    head: string | null;
    activitiesCount: number;
    overallProgress: number;
    completedCount: number;
    inProgressCount: number;
    delayedCount: number;
    pillars?: string[];
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
            <div className="d-flex justify-content-center align-items-center min-vh-50 py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const departmentsRaw = data.departments ?? [];
    const filteredDepartments = departmentsRaw.filter((dept) => {
        if (pillarFilter !== 'All Pillars') {
            const pillars = dept.pillars ?? (dept.recentActivities ?? []).map((a: DepartmentActivity) => a.pillar).filter(Boolean);
            if (!pillars.length || !pillars.includes(pillarFilter)) return false;
        }
        if (statusFilter === 'On Track') {
            const hasOnTrack = (dept.completedCount ?? 0) + (dept.inProgressCount ?? 0) > 0;
            return hasOnTrack;
        }
        if (statusFilter === 'Delayed') return (dept.delayedCount ?? 0) > 0;
        return true;
    });

    const roots = departmentsRaw.filter((d) => d.parent_id == null);
    const childrenByParentId: Record<number, DepartmentDrillDown[]> = {};
    departmentsRaw.forEach((d) => {
        if (d.parent_id != null) {
            if (!childrenByParentId[d.parent_id]) childrenByParentId[d.parent_id] = [];
            childrenByParentId[d.parent_id].push(d);
        }
    });
    const filteredIds = new Set(filteredDepartments.map((d) => d.id));
    const rootsToShow = roots.filter(
        (root) => filteredIds.has(root.id) || (childrenByParentId[root.id] ?? []).some((c) => filteredIds.has(c.id))
    );

    const toggleUnit = (id: number) => {
        setExpandedUnit(expandedUnit === id ? null : id);
    };

    const getPerformanceLabel = (progress: number) => {
        if (progress >= 85) return { label: 'Excellent', bg: '#dcfce7', color: '#15803d' };
        if (progress >= 70) return { label: 'Good', bg: '#fef9c3', color: '#a16207' };
        if (progress >= 50) return { label: 'Fair', bg: '#fde8d8', color: '#c2410c' };
        return { label: 'Critical', bg: '#fee2e2', color: '#b91c1c' };
    };

    const safeStats = {
        totalActivities: Number(data.stats?.totalActivities ?? 0),
        onTrack: Number(data.stats?.onTrack ?? 0),
        inProgress: Number(data.stats?.inProgress ?? 0),
        delayed: Number(data.stats?.delayed ?? 0),
    };

    return (
        <div id="page-strategic" className="page-section active-page">
            <div className="alert alert-primary alert-strip alert-dismissible fade show mb-4 d-flex align-items-center gap-2" role="alert" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--mubs-blue)' }}>info</span>
                <div>You are viewing a <strong>live snapshot</strong> of the institutional strategic plan. Expand a faculty or office to see its departments and units with progress.</div>
                <button type="button" className="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>

            {/* Summary stats */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-blue)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900 }}>{safeStats.totalActivities}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">Total Activities</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid #10b981', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669' }}>{safeStats.onTrack}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">On Track</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-yellow)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{safeStats.inProgress}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">In Progress</div>
                    </div>
                </div>
                <div className="col-6 col-sm-3">
                    <div className="stat-card text-center" style={{ borderLeft: '4px solid var(--mubs-red)', padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--mubs-red)' }}>{safeStats.delayed}</div>
                        <div className="stat-label text-muted small fw-bold text-uppercase">Delayed</div>
                    </div>
                </div>
            </div>

            {/* Faculties & Offices drill-down */}
            <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center" style={{ fontSize: '1rem' }}>
                    <span className="material-symbols-outlined me-2 text-primary" style={{ fontSize: '20px' }}>account_tree</span>
                    Faculties &amp; Offices — Expand to view departments and units
                </h6>
                <div className="d-flex gap-2">
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '150px', fontSize: '.8rem' }}
                        value={pillarFilter}
                        onChange={(e) => setPillarFilter(e.target.value)}
                    >
                        <option>All Pillars</option>
                        {STRATEGIC_PILLARS_2025_2030.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
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

            {/* Faculty/Office rows (expand to show departments/units with progress) */}
            <div className="d-flex flex-column gap-3">
                {rootsToShow.length === 0 ? (
                    <div className="text-center py-5 text-muted">No faculties or offices match the selected filters.</div>
                ) : rootsToShow.map((root) => {
                    const children = (childrenByParentId[root.id] ?? []).filter((c) => filteredIds.has(c.id));
                    const isExpanded = expandedUnit === root.id;
                    return (
                        <div key={root.id} className="bg-white rounded-3 shadow-sm border overflow-hidden">
                            <div
                                className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                                onClick={() => toggleUnit(root.id)}
                                style={{ cursor: 'pointer', transition: 'all 0.2s ease', borderLeft: isExpanded ? '4px solid var(--mubs-blue)' : '4px solid transparent' }}
                            >
                                <div className="d-flex align-items-center gap-3">
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bfdbfe' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>account_balance</span>
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark" style={{ fontSize: '.95rem' }}>{root.name}</div>
                                        <div className="text-muted" style={{ fontSize: '.75rem' }}>
                                            {children.length} department{children.length !== 1 ? 's' : ''} / unit{children.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-muted" style={{ fontSize: '22px', transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    expand_more
                                </span>
                            </div>

                            {isExpanded && (
                                <div className="border-top" style={{ background: '#f8fafc' }}>
                                    {children.length === 0 ? (
                                        <div className="p-4 text-center text-muted small">No departments or units under this faculty/office match the filters.</div>
                                    ) : (
                                        <div className="p-3 pt-2 d-flex flex-column gap-2">
                                            {children.map((dept) => {
                                                const progress = Math.max(0, Math.min(100, Number(dept.overallProgress ?? 0)));
                                                const perf = getPerformanceLabel(progress);
                                                return (
                                                    <div
                                                        key={dept.id}
                                                        className="d-flex align-items-center gap-3 p-3 rounded-3 bg-white border shadow-sm"
                                                    >
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '18px' }}>business</span>
                                                        </div>
                                                        <div className="flex-fill min-w-0">
                                                            <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{dept.name}</div>
                                                            <div className="d-flex align-items-center gap-2 mt-1">
                                                                <div className="progress flex-grow-1" style={{ height: '8px', borderRadius: '4px', maxWidth: '200px' }}>
                                                                    <div
                                                                        className="progress-bar"
                                                                        style={{
                                                                            width: `${progress}%`,
                                                                            backgroundColor: progress >= 70 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444',
                                                                            borderRadius: '4px',
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="fw-bold text-dark" style={{ fontSize: '.85rem', minWidth: '2.5rem' }}>{progress}%</span>
                                                            </div>
                                                            <div className="text-muted" style={{ fontSize: '.72rem', marginTop: '2px' }}>
                                                                {Number(dept.activitiesCount ?? 0)} activities
                                                                {dept.head ? ` · ${dept.head}` : ''}
                                                            </div>
                                                        </div>
                                                        <span className="status-badge" style={{ background: perf.bg, color: perf.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '.65rem' }}>
                                                            {perf.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
