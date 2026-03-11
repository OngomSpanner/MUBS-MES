'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface Activity {
    id: number;
    title: string;
    pillar: string;
    target_kpi: string;
    status: string;
    progress: number;
    end_date: string;
    unit_name: string;
    total_tasks: number;
    completed_tasks: number;
    parent_title?: string | null;
}

interface ActivityData {
    activities: Activity[];
    stats: {
        total: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
    };
}

export default function DepartmentStrategicActivities() {
    const router = useRouter();
    const [data, setData] = useState<ActivityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Statuses');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/department-head/activities');
                setData(response.data);
            } catch (error: any) {
                console.error('Error fetching activities:', error);
                setError(error.response?.data?.message || 'Failed to load department activities. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Activities</h5>
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

    const filteredActivities = data.activities.filter(a => {
        const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.pillar && a.pillar.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All Statuses' || a.status === statusFilter || (statusFilter === 'Completed' && a.status === 'On Track');
        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div id="page-activities" className="page-section active-page">
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment"
                        label="Total Activities"
                        value={data.stats.total}
                        badge="Assigned"
                        badgeIcon="info"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="check_circle"
                        label="On Track"
                        value={data.stats.onTrack}
                        badge="Healthy"
                        badgeIcon="done_all"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="pending"
                        label="In Progress"
                        value={data.stats.inProgress}
                        badge="Active"
                        badgeIcon="trending_up"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="warning"
                        label="Delayed"
                        value={data.stats.delayed}
                        badge="Attention"
                        badgeIcon="error"
                        color="red"
                    />
                </div>
            </div>

            <div className="table-card shadow-sm">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>track_changes</span>
                        Activities Assigned to My Department
                    </h5>
                    <div className="d-flex gap-2 flex-wrap">
                        <div className="input-group input-group-sm" style={{ width: '190px' }}>
                            <span className="input-group-text bg-white border-end-0">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0"
                                placeholder="Search activities..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '140px' }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option>All Statuses</option>
                            <option>On Track</option>
                            <option>In Progress</option>
                            <option>Delayed</option>
                            <option>Completed</option>
                            <option>Not Started</option>
                        </select>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Activity</th>
                                <th>Pillar</th>
                                <th>Target / KPI</th>
                                <th>Deadline</th>
                                <th>Tasks</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th className="pe-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-5 text-muted">
                                        No activities found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredActivities.map((a) => (
                                    <tr key={a.id}>
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="activity-icon-rounded" style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    background: '#f1f5f9',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--mubs-blue)'
                                                }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                                        {a.pillar?.includes('Research') ? 'science' :
                                                            a.pillar?.includes('Equity') ? 'shield' :
                                                                a.pillar?.includes('Human Capital') ? 'groups' :
                                                                    a.pillar?.includes('Partnerships') ? 'handshake' : 'description'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{a.title}</div>
                                                    <div className="text-muted small">{a.parent_title ? `Under: ${a.parent_title}` : `ID: #${a.id}`}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{
                                                background: a.pillar?.includes('Research') ? '#eff6ff' : (a.pillar?.includes('Equity') ? '#fef3c7' : (a.pillar?.includes('Human Capital') ? '#ecfdf5' : (a.pillar?.includes('Partnerships') ? '#f5f3ff' : '#f1f5f9'))),
                                                color: a.pillar?.includes('Research') ? '#1d4ed8' : (a.pillar?.includes('Equity') ? '#b45309' : (a.pillar?.includes('Human Capital') ? '#059669' : (a.pillar?.includes('Partnerships') ? '#7c3aed' : '#475569'))),
                                                fontSize: '0.7rem'
                                            }}>{a.pillar || 'Uncategorized'}</span>
                                        </td>
                                        <td className="small" style={{ fontSize: '.8rem' }}>{a.target_kpi}</td>
                                        <td className="small" style={{ fontSize: '.8rem' }}>{formatDate(a.end_date)}</td>
                                        <td className="small" style={{ fontSize: '.8rem' }}><span className="fw-bold text-primary">{a.completed_tasks}</span>/{a.total_tasks}</td>
                                        <td style={{ minWidth: '120px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress w-100" style={{ height: '6px', borderRadius: '10px' }}>
                                                    <div className="progress-bar" style={{
                                                        width: `${a.progress}%`,
                                                        background: a.progress > 70 ? '#10b981' : (a.progress > 30 ? '#f59e0b' : '#3b82f6'),
                                                        borderRadius: '10px'
                                                    }}></div>
                                                </div>
                                                <span className="small fw-bold" style={{ fontSize: '.75rem' }}>{a.progress}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{
                                                background: a.status === 'On Track' ? '#dcfce7' : (a.status === 'In Progress' ? '#fef9c3' : (a.status === 'Delayed' ? '#fee2e2' : '#f1f5f9')),
                                                color: a.status === 'On Track' ? '#15803d' : (a.status === 'In Progress' ? '#a16207' : (a.status === 'Delayed' ? '#b91c1c' : '#475569')),
                                                fontSize: '0.7rem'
                                            }}>{a.status}</span>
                                        </td>
                                        <td className="pe-4 text-end">
                                            {a.parent_title ? (
                                                <button
                                                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 fw-bold"
                                                    style={{ fontSize: '.75rem' }}
                                                    onClick={() => router.push(`/department-head?pg=tasks&activity=${encodeURIComponent(a.parent_title!)}`)}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                    <span>View in Tasks</span>
                                                </button>
                                            ) : a.total_tasks === 0 ? (
                                                <button
                                                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 fw-bold shadow-sm"
                                                    style={{ fontSize: '.75rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                                    onClick={() => router.push(`/department-head?pg=tasks&activity=${encodeURIComponent(a.title)}`)}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                                    <span>Create Task</span>
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 fw-bold"
                                                    style={{ fontSize: '.75rem' }}
                                                    onClick={() => router.push(`/department-head?pg=tasks&activity=${encodeURIComponent(a.title)}`)}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                    <span>View Tasks</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <span className="footer-label" style={{ fontSize: '.8rem', color: '#64748b' }}>Showing {filteredActivities.length} of {data.stats.total} activities</span>
                </div>
            </div>
        </div>
    );
}
