"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import CreateActivityModal from '@/components/Modals/CreateActivityModal';
import axios from 'axios';
import { linkify } from '@/lib/linkify';

function isUnassigned(a: { department_id?: number | null; department?: string }): boolean {
    return a.department_id == null || !a.department?.trim() || a.department === '-';
}

// DB status values: pending, in_progress, completed, overdue
const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Delayed' }
];

function statusToLabel(s: string): string {
    const map: Record<string, string> = {
        pending: 'Not Started',
        in_progress: 'In Progress',
        completed: 'Completed',
        overdue: 'Delayed'
    };
    return map[s] ?? s;
}

interface Activity {
    id: number;
    row_key?: string;
    title: string;
    pillar: string;
    department: string;
    department_id: number | null;
    department_ids?: number[];
    faculty_office: string;
    target_kpi: string;
    start_date: string;
    end_date: string;
    progress: number;
    status: string;
    priority: string;
    parent_id: number | null;
    parent_title?: string;
    strategic_objective: string;
    timeline: string;
    description: string;
}

export default function StrategicView() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'reassign'>('create');
    const [statusFilter, setStatusFilter] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('All Offices/Faculties');
    const [departmentFilter, setDepartmentFilter] = useState('All Departments/Units');
    const [officeFacultyOptions, setOfficeFacultyOptions] = useState<{ id: number; name: string }[]>([]);
    const [departmentUnitOptions, setDepartmentUnitOptions] = useState<{ id: number; name: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;
    const [stats, setStats] = useState({
        total: 0,
        onTrack: 0,
        inProgress: 0,
        delayed: 0
    });

    const filteredActivities = activities.filter(a => {
        const matchStatus = !statusFilter || a.status === statusFilter;
        const matchDept = departmentFilter === 'All Departments/Units' || a.department === departmentFilter;
        const matchFaculty = facultyFilter === 'All Offices/Faculties' || a.faculty_office === facultyFilter;
        return matchStatus && matchDept && matchFaculty;
    });

    const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
    const paginatedActivities = filteredActivities.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    // Reset to page 1 whenever filters change
    useEffect(() => { setCurrentPage(1); }, [statusFilter, departmentFilter, facultyFilter]);

    useEffect(() => {
        fetchActivities();
        fetchStats();
    }, []);

    useEffect(() => {
        const loadDepartments = async () => {
            try {
                const response = await axios.get('/api/departments');
                const list = Array.isArray(response.data) ? response.data : [];
                setOfficeFacultyOptions(list.filter((d: { parent_id: number | null }) => d.parent_id == null).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
                setDepartmentUnitOptions(list.filter((d: { parent_id: number | null }) => d.parent_id != null).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
            } catch (e) {
                console.error('Error loading departments for filters', e);
            }
        };
        loadDepartments();
    }, []);

    const fetchActivities = async () => {
        try {
            const response = await axios.get('/api/activities');
            const data = response?.data;
            setActivities(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching activities:', error);
            setActivities([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get('/api/dashboard/stats');
            setStats({
                total: response.data.stats.totalActivities,
                onTrack: response.data.stats.onTrackActivities,
                inProgress: response.data.stats.inProgressActivities,
                delayed: response.data.stats.delayedActivities
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const openModal = (mode: 'create' | 'edit' | 'reassign', activity?: Activity) => {
        setModalMode(mode);
        setSelectedActivity(activity ?? null);
        setShowCreateModal(true);
    };

    const openViewModal = (activity: Activity) => {
        setSelectedActivity(activity);
        setShowViewModal(true);
    };

    const handleDelete = async (activity: Activity) => {
        if (!confirm(`Delete "${activity.title}"? This cannot be undone.`)) return;
        try {
            await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });
            fetchActivities();
            fetchStats();
        } catch (error) {
            console.error('Error deleting activity:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'Not Started': { bg: '#f1f5f9', color: '#475569' },
            'In Progress': { bg: '#fef9c3', color: '#a16207' },
            'Completed': { bg: '#dcfce7', color: '#15803d' },
            'Delayed': { bg: '#fee2e2', color: '#b91c1c' }
        };
        const style = styles[status] || styles['Not Started'];
        return { backgroundColor: style.bg, color: style.color };
    };

    const getPriorityBadge = (priority: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'High': { bg: '#fee2e2', color: '#b91c1c' },
            'Medium': { bg: '#fef9c3', color: '#a16207' },
            'Low': { bg: '#eff6ff', color: 'var(--mubs-blue)' }
        };
        const style = styles[priority] || styles['Medium'];
        return { backgroundColor: style.bg, color: style.color };
    };

    return (
        <Layout>
            <div className="row g-4 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-blue)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#eff6ff' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>track_changes</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Plan 2024-28</span>
                        </div>
                        <div className="stat-label">Main Activities</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                                <span className="material-symbols-outlined" style={{ color: '#059669' }}>task_alt</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#ecfdf5', color: '#059669' }}>Completed</span>
                        </div>
                        <div className="stat-label">On Track</div>
                        <div className="stat-value">{stats.onTrack}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-yellow)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fffbeb' }}>
                                <span className="material-symbols-outlined" style={{ color: '#b45309' }}>pending</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#fffbeb', color: '#b45309' }}>In Progress</span>
                        </div>
                        <div className="stat-label">In Progress</div>
                        <div className="stat-value">{stats.inProgress}</div>
                    </div>
                </div>
                <div className="col-sm-6 col-xl-3">
                    <div className="stat-card" style={{ borderLeftColor: 'var(--mubs-red)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="stat-icon" style={{ background: '#fff1f2' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)' }}>error</span>
                            </div>
                            <span className="stat-badge" style={{ background: '#fff1f2', color: 'var(--mubs-red)' }}>Alert</span>
                        </div>
                        <div className="stat-label">Delayed</div>
                        <div className="stat-value">{stats.delayed}</div>
                    </div>
                </div>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                            track_changes
                        </span>
                        Strategic Plan Activities
                    </h5>
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                        <span className="text-muted small me-1">Filters:</span>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '200px' }}
                            value={facultyFilter}
                            onChange={e => setFacultyFilter(e.target.value)}
                            title="Filter by Office/Faculty"
                        >
                            <option value="All Offices/Faculties">All Offices/Faculties</option>
                            {officeFacultyOptions.map(o => (
                                <option key={o.id} value={o.name}>{o.name}</option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '200px' }}
                            value={departmentFilter}
                            onChange={e => setDepartmentFilter(e.target.value)}
                            title="Filter by Department/Unit"
                        >
                            <option value="All Departments/Units">All Departments/Units</option>
                            {departmentUnitOptions.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '140px' }}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            title="Filter by Status"
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <button
                            className="btn btn-sm create-btn"
                            onClick={() => openModal('create')}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                            Add Activity
                        </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table mb-0">
                        <thead>
                            <tr>
                                <th>Activity</th>
                                <th>Strategic Objective</th>
                                <th>Office/Faculty</th>
                                <th>Department/Unit</th>
                                <th>Priority</th>
                                <th>Timeline</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : activities.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-4 text-muted">
                                        No activities found
                                    </td>
                                </tr>
                            ) : (
                                paginatedActivities.map((activity) => (
                                    <tr key={activity.row_key ?? `${activity.id}-${activity.department_id ?? 0}`}>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="activity-icon">
                                                    <span className="material-symbols-outlined">
                                                        {activity.pillar?.includes('Research') ? 'science' :
                                                            activity.pillar?.includes('Equity') ? 'shield' :
                                                                activity.pillar?.includes('Human Capital') ? 'groups' :
                                                                    activity.pillar?.includes('Partnerships') ? 'handshake' : 'assignment'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>
                                                        {activity.title}
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: '.72rem' }}>
                                                        {activity.pillar} {activity.parent_title && `• Sub-activity of ${activity.parent_title}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '.83rem', maxWidth: '150px' }} className="text-truncate" title={activity.strategic_objective}>
                                            {activity.strategic_objective || '-'}
                                        </td>
                                        <td style={{ fontSize: '.83rem' }}>{activity.faculty_office || '-'}</td>
                                        <td style={{ fontSize: '.83rem' }}>
                                            {activity.department || '—'}
                                            {isUnassigned(activity) && (
                                                <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '.65rem' }} title="No department assigned">Needs assignment</span>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className="status-badge"
                                                style={{ ...getPriorityBadge(activity.priority), fontSize: '.7rem' }}
                                            >
                                                {activity.priority}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '.83rem' }}>{activity.timeline || '-'}</td>
                                        <td style={{ minWidth: '100px' }}>
                                            <div className="progress-bar-custom">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{
                                                        width: `${activity.progress}%`,
                                                        background: activity.progress >= 70 ? '#005696' :
                                                            activity.progress >= 50 ? '#ffcd00' : '#e31837'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: '3px' }}>
                                                {activity.progress}%
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className="status-badge"
                                                style={getStatusBadge(statusToLabel(activity.status))}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>circle</span>
                                                {statusToLabel(activity.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" 
                                                onClick={(e) => { e.preventDefault(); openViewModal(activity); }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">
                        Showing {filteredActivities.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredActivities.length)} of {filteredActivities.length} activities
                    </span>
                    <div className="d-flex gap-1">
                        <button
                            className="page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >‹</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={`page-btn ${page === currentPage ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                            >{page}</button>
                        ))}
                        <button
                            className="page-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >›</button>
                    </div>
                </div>
            </div>

            <CreateActivityModal
                show={showCreateModal}
                onHide={() => { setShowCreateModal(false); setSelectedActivity(null); }}
                onActivityCreated={() => { fetchActivities(); fetchStats(); }}
                activity={selectedActivity}
                mode={modalMode}
            />

            {/* View Activity Modal */}
            {selectedActivity && (
                <div className={`modal fade ${showViewModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ backgroundColor: showViewModal ? 'rgba(0,0,0,0.5)' : 'transparent' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header modal-header-mubs text-white" style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                                <h5 className="modal-title d-flex align-items-center gap-2 fw-bold">
                                    <span className="material-symbols-outlined">visibility</span>
                                    Activity Details
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row g-4">
                                    <div className="col-12 border-bottom pb-3">
                                        <h4 className="fw-bold mb-1" style={{ color: '#005696' }}>{selectedActivity.title}</h4>
                                        <span className="badge" style={getPriorityBadge(selectedActivity.priority)}>{selectedActivity.priority} Priority</span>
                                        <span className="badge ms-2" style={getStatusBadge(selectedActivity.status)}>{selectedActivity.status}</span>
                                    </div>
                                    
                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Strategic Pillar</p>
                                        <p className="mb-0">{selectedActivity.pillar}</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Strategic Objective</p>
                                        <p className="mb-0" style={{ wordBreak: 'break-word' }}>{linkify(selectedActivity.strategic_objective) || 'N/A'}</p>
                                    </div>

                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Assigned Department</p>
                                        <p className="mb-0">
                                            {selectedActivity.department || '—'}
                                            {isUnassigned(selectedActivity) && (
                                                <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '.7rem' }}>Needs assignment</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Target / KPI</p>
                                        <p className="mb-0" style={{ wordBreak: 'break-word' }}>{linkify(selectedActivity.target_kpi) || 'N/A'}</p>
                                    </div>

                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Timeline</p>
                                        <p className="mb-0">{selectedActivity.timeline}</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Progress</p>
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="progress flex-grow-1" style={{ height: '8px' }}>
                                                <div 
                                                    className="progress-bar" 
                                                    role="progressbar" 
                                                    style={{ width: `${selectedActivity.progress}%`, backgroundColor: '#005696' }}
                                                ></div>
                                            </div>
                                            <span className="small fw-bold">{selectedActivity.progress}%</span>
                                        </div>
                                    </div>

                                    <div className="col-12">
                                        <p className="text-muted small fw-bold mb-1 text-uppercase">Strategic Objectives</p>
                                        <div className="p-3 bg-light rounded text-dark" style={{ minHeight: '80px', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {linkify(selectedActivity.strategic_objective || selectedActivity.description) || 'None provided.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-3 pt-0 d-flex justify-content-between">
                                <button type="button" className="btn btn-light" onClick={() => setShowViewModal(false)}>
                                    <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>close</span>
                                    Close
                                </button>
                                <div className="d-flex gap-2">
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-primary"
                                        onClick={() => {
                                            setShowViewModal(false);
                                            openModal('edit', selectedActivity);
                                        }}
                                    >
                                        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>edit</span>
                                        Edit
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-warning"
                                        onClick={() => {
                                            setShowViewModal(false);
                                            openModal('reassign', selectedActivity);
                                        }}
                                    >
                                        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>assignment_ind</span>
                                        Reassign
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-danger"
                                        onClick={() => {
                                            setShowViewModal(false);
                                            handleDelete(selectedActivity);
                                        }}
                                    >
                                        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '18px' }}>delete</span>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
