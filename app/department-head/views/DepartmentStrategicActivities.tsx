'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface Activity {
    id: number;
    title: string;
    description?: string;
    strategic_objective?: string;
    pillar: string;
    target_kpi: string;
    kpi_target_value?: number;
    status: string;
    progress: number;
    start_date?: string;
    startDate?: string;
    end_date: string;
    unit_name: string;
    total_tasks: number;
    completed_tasks: number;
    parent_title?: string | null;
    source?: string;
    standard_id?: number | null;
    unit_of_measure?: string;
    /** From standard_processes for this activity's standard */
    process_tasks_total?: number;
    /** Distinct process tasks with assignment status evaluated or completed */
    process_tasks_done?: number;
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

function processAssignmentCoversTask(a: {
    staff_id: number | null;
    staff_name: string | null;
    subtasks?: Array<{ assigned_to: number }>;
}): boolean {
    const direct =
        (a.staff_id != null && Number(a.staff_id) > 0) || String(a.staff_name ?? '').trim() !== '';
    if (direct) return true;
    const subs = Array.isArray(a.subtasks) ? a.subtasks : [];
    return subs.length > 0 && subs.every((s) => s.assigned_to != null && Number(s.assigned_to) > 0);
}

export default function DepartmentStrategicActivities() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [data, setData] = useState<ActivityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Statuses');
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);
    
    // --- Process assignment state (a process is made of tasks from the standard) ---
    type ProcessTask = {
        id: number;
        /** Task title from the standard definition */
        taskName: string;
        taskOrder: number;
        standard_id: number;
        performance_indicator?: string | null;
    };

    const mapApiProcessToTask = (p: Record<string, unknown>): ProcessTask => ({
        id: Number(p.id),
        taskName: String(p.step_name ?? p.task_name ?? '').trim() || '—',
        taskOrder: Number(p.step_order) || 0,
        standard_id: Number(p.standard_id),
    });
    type Assignment = {
        id: number;
        standard_process_id: number;
        staff_id: number | null;
        status: string;
        staff_name: string | null;
        start_date?: string | null;
        subtasks?: Array<{
            id: number;
            title: string;
            assigned_to: number;
            assigned_to_name: string;
            status: string;
        }>;
    };
    const [processTasks, setProcessTasks] = useState<ProcessTask[]>([]);
    const [processAssignments, setProcessAssignments] = useState<Assignment[]>([]);
    const [assigningTask, setAssigningTask] = useState<ProcessTask | null>(null);
    const [assignStaffIds, setAssignStaffIds] = useState<number[]>([]);
    const [staffSearchTerm, setStaffSearchTerm] = useState('');
    const [showStaffSearchResults, setShowStaffSearchResults] = useState(false);
    const [staffPositionAddAll, setStaffPositionAddAll] = useState<string>('');
    const [assignSaving, setAssignSaving] = useState(false);
    const [assignBreakdownEnabled, setAssignBreakdownEnabled] = useState(false);
    const [assignSubtasks, setAssignSubtasks] = useState<Array<{ title: string; assigned_to: number | '' }>>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
    const [processCatalogLoaded, setProcessCatalogLoaded] = useState(false);
    const [showAssignmentsRequiredDialog, setShowAssignmentsRequiredDialog] = useState(false);
    const detailLoadGen = useRef(0);

    const normalizeForCompare = (s?: string | null) =>
        String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

    const fetchProcessTasks = async (standardId: number, loadGen?: number) => {
        try {
            const res = await axios.get(`/api/standards`);
            const standard = (res.data as any[]).find((s: any) => s.id === standardId);
            const raw = standard?.processes || [];
            const indicator =
                standard?.performance_indicator != null && String(standard.performance_indicator).trim() !== ''
                    ? String(standard.performance_indicator)
                    : null;

            if (indicator && selectedActivity && !selectedActivity.target_kpi) {
                setSelectedActivity(prev => prev ? { ...prev, target_kpi: indicator } : null);
            }

            setProcessTasks(
                raw.map((p: Record<string, unknown>) => ({
                    ...mapApiProcessToTask(p),
                    performance_indicator: indicator,
                }))
            );
        } catch {
            setProcessTasks([]);
        } finally {
            if (loadGen == null || loadGen === detailLoadGen.current) {
                setProcessCatalogLoaded(true);
            }
        }
    };

    const fetchProcessAssignments = async (activityId: number, loadGen?: number) => {
        try {
            const res = await axios.get('/api/department-head/process-assignments');
            setProcessAssignments((res.data as any[]).filter((a: any) => a.activity_id === activityId));
        } catch {
            setProcessAssignments([]);
        } finally {
            if (loadGen == null || loadGen === detailLoadGen.current) {
                setAssignmentsLoaded(true);
            }
        }
    };

    const processDataReady = assignmentsLoaded && processCatalogLoaded;

    const canViewProcesses = useMemo(() => {
        if (!selectedActivity || !processDataReady) return false;
        if (!selectedActivity.standard_id || processTasks.length === 0) return true;
        for (const t of processTasks) {
            const ok = processAssignments.some(
                (a) => a.standard_process_id === t.id && processAssignmentCoversTask(a)
            );
            if (!ok) return false;
        }
        return true;
    }, [selectedActivity, processDataReady, processTasks, processAssignments]);

    useEffect(() => {
        if (processDataReady && canViewProcesses) setShowAssignmentsRequiredDialog(false);
    }, [processDataReady, canViewProcesses]);

    const handleAssignTask = async () => {
        if (!assigningTask || assignStaffIds.length === 0 || !selectedActivity) return;
        setAssignSaving(true);
        try {
            const payload: any = {
                activity_id: selectedActivity.id,
                standard_process_id: assigningTask.id,
                staff_ids: assignStaffIds,
            };

            if (assignBreakdownEnabled) {
                const cleaned = assignSubtasks
                    .map((s) => ({
                        title: (s.title || '').trim(),
                        assigned_to: s.assigned_to === '' ? null : Number(s.assigned_to),
                    }))
                    .filter((s) => s.title && s.assigned_to != null);

                if (cleaned.length === 0) {
                    alert('Add at least one sub-task with an assignee.');
                    return;
                }

                payload.breakdown = { subtasks: cleaned };
                // For breakdown mode we create a container assignment; staff_ids is only used for UI validation.
            }

            const { data, status } = await axios.post('/api/department-head/process-assignments', payload);
            await fetchProcessAssignments(selectedActivity.id);
            const created = Number(data?.created) || 0;
            const skippedDup = Number(data?.skippedDuplicate) || 0;
            if (created === 0) {
                alert(data?.message || 'No new assignments (selected staff may already be assigned to this task).');
                return;
            }
            if (skippedDup > 0) {
                alert(`${data?.message || 'Assigned.'}\nSkipped ${skippedDup} (already assigned).`);
            }
            setShowAssignModal(false);
            setAssignStaffIds([]);
            setStaffSearchTerm('');
            setAssignBreakdownEnabled(false);
            setAssignSubtasks([]);
            setAssigningTask(null);
        } catch (e: any) {
            alert(e.response?.data?.message || 'Could not save assignment');
        } finally {
            setAssignSaving(false);
        }
    };

    const handleRemoveAssignment = async (assignmentId: number) => {
        if (!confirm('Remove this assignment?')) return;
        try {
            await axios.delete(`/api/department-head/process-assignments/${assignmentId}`);
            if (selectedActivity) await fetchProcessAssignments(selectedActivity.id);
        } catch { alert('Could not remove assignment'); }
    };

    const toYMD = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [departmentUsers, setDepartmentUsers] = useState<{ id: number; full_name: string; position: string | null }[]>([]);

    useEffect(() => {
        if (!showAssignModal) return;
        (async () => {
            try {
                const res = await axios.get('/api/users/department');
                setDepartmentUsers(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Failed to fetch department users:', err);
                setDepartmentUsers([]);
            }
        })();
    }, [showAssignModal]);

    const staffSearchResults = (() => {
        const q = staffSearchTerm.trim().toLowerCase();
        const pool = departmentUsers.filter((u) => !assignStaffIds.includes(u.id));
        const matches =
            q === ''
                ? pool
                : pool.filter((u) => {
                      const name = (u.full_name || '').toLowerCase();
                      const pos = (u.position || '').toLowerCase();
                      return name.includes(q) || pos.includes(q);
                  });
        return matches.slice(0, 10);
    })();

    const addStaffToAssign = (id: number) => {
        if (!assignStaffIds.includes(id)) setAssignStaffIds((prev) => [...prev, id]);
        setStaffSearchTerm('');
        setShowStaffSearchResults(false);
    };

    const removeStaffFromAssign = (id: number) => {
        setAssignStaffIds((prev) => prev.filter((x) => x !== id));
    };

    const addAllDepartmentStaff = () => {
        const all = departmentUsers.map((u) => u.id).filter((id) => !assignStaffIds.includes(id));
        if (all.length === 0) return;
        setAssignStaffIds((prev) => [...new Set([...prev, ...all])]);
        setStaffSearchTerm('');
        setShowStaffSearchResults(false);
    };

    const addAllDepartmentStaffByPosition = (positionLabel?: string) => {
        const selectedKey = normalizeForCompare(positionLabel ?? staffPositionAddAll);
        if (!selectedKey) return;
        const matches = departmentUsers
            .filter((u) => normalizeForCompare(u.position) === selectedKey)
            .map((u) => u.id)
            .filter((id) => !assignStaffIds.includes(id));
        if (matches.length === 0) return;
        setAssignStaffIds((prev) => [...new Set([...prev, ...matches])]);
    };

    const availablePositions = (() => {
        const map = new Map<string, string>();
        for (const u of departmentUsers) {
            const key = normalizeForCompare(u.position);
            if (!key) continue;
            if (!map.has(key)) map.set(key, u.position || '');
        }
        return [...map.values()].filter(Boolean).sort((a, b) => a.localeCompare(b));
    })();



    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/department-head/activities', {
                params: { _: Date.now() },
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
            });
            setData(response.data);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching activities:', err);
            setError(err.response?.data?.message || 'Failed to load department activities. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Refetch whenever we're on activities page (e.g. after coming back from Submissions/Evaluations)
    const pg = searchParams.get('pg') || '';
    useEffect(() => {
        if (pg === 'activities') fetchData();
    }, [pg, fetchData]);

    // Refetch when user returns to tab
    useEffect(() => {
        const onFocus = () => { if (document.visibilityState === 'visible' && pg === 'activities') fetchData(); };
        document.addEventListener('visibilitychange', onFocus);
        return () => document.removeEventListener('visibilitychange', onFocus);
    }, [pg, fetchData]);

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

    const formatDate = (dateStr: string | undefined) => {
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
                    <div className="d-flex gap-2 flex-wrap align-items-center">
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
                                <th>Target KPI</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Processes</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th className="pe-4 text-end text-nowrap" style={{ width: '1%', minWidth: '128px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-5 text-muted">
                                        No activities found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredActivities.map((a) => {
                                    const parentLine = a.parent_title?.trim();
                                    const titleLine = a.title?.trim() ?? '';
                                    const showUnderParent =
                                        !!parentLine && parentLine.toLowerCase() !== titleLine.toLowerCase();
                                    const showIdLine = !parentLine;
                                    return (
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
                                                    {showUnderParent ? (
                                                        <div className="text-muted small">Under: {parentLine}</div>
                                                    ) : showIdLine ? (
                                                        <div className="text-muted small">ID: #{a.id}</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="small text-dark fw-normal" style={{ fontSize: '.8rem', textTransform: 'none' }}>
                                            {a.pillar || 'Uncategorized'}
                                        </td>
                                        <td className="small" style={{ fontSize: '.8rem' }}>{a.kpi_target_value ?? a.target_kpi}</td>
                                        <td className="small" style={{ fontSize: '.8rem' }}>{formatDate(a.start_date || '')}</td>
                                        <td className="small" style={{ fontSize: '.8rem' }}>{formatDate(a.end_date)}</td>
                                        <td className="small" style={{ fontSize: '.8rem' }} title="Process tasks completed (evaluated or completed) / tasks defined on the linked standard">
                                            {(Number(a.process_tasks_total) || 0) > 0 ? (
                                                <>
                                                    <span className="fw-bold text-primary">{Number(a.process_tasks_done) || 0}</span>
                                                    /{Number(a.process_tasks_total) || 0}
                                                </>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td style={{ minWidth: '120px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress w-100" style={{ height: '6px', borderRadius: '10px' }}>
                                                    <div className="progress-bar" style={{
                                                        width: `${a.progress ?? 0}%`,
                                                        background: (a.progress ?? 0) > 70 ? '#10b981' : ((a.progress ?? 0) > 30 ? '#f59e0b' : '#3b82f6'),
                                                        borderRadius: '10px'
                                                    }}></div>
                                                </div>
                                                <span className="small fw-bold" style={{ fontSize: '.75rem' }}>{a.progress ?? 0}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{
                                                background: a.status === 'On Track' ? '#dcfce7' : (a.status === 'In Progress' ? '#fef9c3' : (a.status === 'Delayed' ? '#fee2e2' : '#f1f5f9')),
                                                color: a.status === 'On Track' ? '#15803d' : (a.status === 'In Progress' ? '#a16207' : (a.status === 'Delayed' ? '#b91c1c' : '#475569')),
                                                fontSize: '0.7rem'
                                            }}>{a.status}</span>
                                        </td>
                                        <td className="pe-4 text-end align-middle text-nowrap" style={{ width: '1%', minWidth: '128px' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 fw-bold text-nowrap flex-shrink-0"
                                                style={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}
                                                onClick={() => {
                                                    setSelectedActivity(a);
                                                    setShowViewModal(true);
                                                    setShowAssignmentsRequiredDialog(false);
                                                    detailLoadGen.current += 1;
                                                    const gen = detailLoadGen.current;
                                                    setAssignmentsLoaded(false);
                                                    setProcessCatalogLoaded(false);
                                                    setProcessTasks([]);
                                                    setProcessAssignments([]);
                                                    void fetchProcessAssignments(a.id, gen);
                                                    if (a.standard_id) {
                                                        void fetchProcessTasks(a.standard_id, gen);
                                                    } else {
                                                        setProcessCatalogLoaded(true);
                                                    }
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                <span>View Details</span>
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-card-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <span className="footer-label" style={{ fontSize: '.8rem', color: '#64748b' }}>Showing {filteredActivities.length} of {data.stats.total} activities</span>
                </div>
            </div>

            {/* View Activity Modal */}
            {selectedActivity && (
                <div className={`modal fade ${showViewModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ backgroundColor: showViewModal ? 'rgba(15, 23, 42, 0.6)' : 'transparent', zIndex: 1050, backdropFilter: 'blur(4px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>visibility</span>
                                    Activity Details
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setShowViewModal(false);
                                        setShowAssignmentsRequiredDialog(false);
                                    }}
                                ></button>
                            </div>
                            <div className="modal-body p-4 pt-3">
                                <div className="row g-4">
                                    <div className="col-12 border-bottom pb-3">
                                        <h4 className="fw-bold mb-1 text-primary" style={{ fontSize: '1.25rem' }}>{selectedActivity.title}</h4>
                                        <div className="d-flex align-items-center gap-2 mt-2">
                                            <span className="status-badge" style={{
                                                background: selectedActivity.status === 'On Track' ? '#dcfce7' : (selectedActivity.status === 'In Progress' ? '#fef9c3' : (selectedActivity.status === 'Delayed' ? '#fee2e2' : '#f1f5f9')),
                                                color: selectedActivity.status === 'On Track' ? '#15803d' : (selectedActivity.status === 'In Progress' ? '#a16207' : (selectedActivity.status === 'Delayed' ? '#b91c1c' : '#475569')),
                                                fontSize: '0.75rem',
                                                padding: '4px 8px',
                                                borderRadius: '6px'
                                            }}>{selectedActivity.status}</span>
                                        </div>
                                    </div>
                                    <div className="col-md-6 mt-3">
                                        <label className="text-muted fw-bold mb-1 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Strategic Pillar</label>
                                        <div className="text-dark fw-medium" style={{ fontSize: '0.9rem' }}>{selectedActivity.pillar || 'N/A'}</div>
                                    </div>
                                    <div className="col-md-6 mt-3">
                                        <label className="text-muted fw-bold mb-1 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Performance Indicator</label>
                                        <div className="text-dark fw-medium mb-0" style={{ fontSize: '0.9rem' }}>
                                            {selectedActivity.target_kpi || 'N/A'}
                                            {selectedActivity.kpi_target_value != null && (
                                                <span className="ms-2 badge bg-primary-subtle text-primary">
                                                    Target: {selectedActivity.kpi_target_value} {selectedActivity.unit_name || ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-md-6 mt-3">
                                        <label className="text-muted fw-bold mb-1 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Performance</label>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="progress flex-grow-1" style={{ height: '8px', borderRadius: '4px' }}>
                                                <div 
                                                    className="progress-bar bg-primary" 
                                                    role="progressbar" 
                                                    style={{ width: `${selectedActivity.progress}%` }}
                                                ></div>
                                            </div>
                                            <span className="fw-black text-primary" style={{ fontSize: '1rem' }}>{selectedActivity.progress}%</span>
                                        </div>
                                    </div>
                                    <div className="col-12 mt-3">
                                        <label className="text-muted fw-bold mb-1 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Objectives</label>
                                        <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <p className="mb-0 text-secondary fw-medium" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                {(
                                                    (selectedActivity.strategic_objective || selectedActivity.description || '').trim() || '—'
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Processes from linked standard */}
                                    {processTasks.length > 0 && (
                                        <div className="col-12 mt-3 border-top pt-3">
                                            <label className="text-muted fw-bold mb-2 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Process tasks</label>
                                            <div className="d-flex flex-column gap-2">
                                                {processTasks.map((task, idx) => {
                                                    const taskAssignments = processAssignments.filter(a => a.standard_process_id === task.id);
                                                    const assignmentIsOpen = (a: Assignment) =>
                                                        a.start_date != null && String(a.start_date).trim() !== '';
                                                    const assignmentIsTerminal = (a: Assignment) => {
                                                        const t = String(a.status ?? '').toLowerCase().trim();
                                                        return t === 'evaluated' || t === 'completed';
                                                    };
                                                    const subtaskIsTerminal = (st: { status?: string | null }) => {
                                                        const t = String(st?.status ?? '').toLowerCase().trim();
                                                        return t === 'evaluated' || t === 'completed';
                                                    };
                                                    const containerAssignmentFullyDone = (a: Assignment) => {
                                                        const hasStaff = String(a.staff_name ?? '').trim() !== '';
                                                        if (hasStaff) return assignmentIsTerminal(a);
                                                        const subs = Array.isArray((a as any).subtasks) ? (a as any).subtasks : [];
                                                        if (subs.length === 0) return assignmentIsTerminal(a);
                                                        return subs.every(subtaskIsTerminal);
                                                    };
                                                    const hideAssign =
                                                        taskAssignments.length > 0 &&
                                                        (taskAssignments.some(assignmentIsOpen) ||
                                                            taskAssignments.some(containerAssignmentFullyDone));
                                                    return (
                                                        <div key={task.id} className="p-2 rounded border" style={{ background: '#f8fafc', fontSize: '0.82rem' }}>
                                                            <div className="d-flex align-items-start justify-content-between gap-2">
                                                                <div className="d-flex align-items-start gap-2">
                                                                    <span className="badge bg-primary-subtle text-primary fw-bold" style={{ minWidth: '22px', fontSize: '0.7rem' }}>{idx + 1}</span>
                                                                    <span className="text-dark fw-medium">{task.taskName}</span>
                                                                </div>
                                                                {!hideAssign ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm d-flex align-items-center gap-1"
                                                                        title="Assign staff to this process task"
                                                                        style={{ fontSize: '0.7rem', background: 'var(--mubs-blue)', color: '#fff', borderRadius: '6px', padding: '2px 8px', whiteSpace: 'nowrap' }}
                                                                        onClick={() => {
                                                                            setAssigningTask(task);
                                                                            setAssignStaffIds([]);
                                                                            setStaffSearchTerm('');
                                                                            setShowAssignModal(true);
                                                                        }}
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person_add</span>
                                                                        Assign
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            {taskAssignments.length > 0 && (
                                                                <div className="mt-2 d-flex flex-wrap gap-1">
                                                                    {taskAssignments.map(sa => {
                                                                        const hasStaff = String(sa.staff_name ?? '').trim() !== '';
                                                                        const subtasks = Array.isArray((sa as any).subtasks) ? (sa as any).subtasks : [];
                                                                        // Container: completion = all sub-tasks done (not parent spa.status alone).
                                                                        const isDone = hasStaff
                                                                            ? assignmentIsTerminal(sa)
                                                                            : subtasks.length > 0
                                                                              ? subtasks.every(subtaskIsTerminal)
                                                                              : assignmentIsTerminal(sa);
                                                                        return (
                                                                            <span key={sa.id} className="badge d-inline-flex align-items-center gap-1" 
                                                                                style={{ 
                                                                                    background: isDone ? '#dcfce7' : '#e0f2fe', 
                                                                                    color: isDone ? '#15803d' : '#0369a1', 
                                                                                    fontSize: '0.7rem', 
                                                                                    fontWeight: 500 
                                                                                }}
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{isDone ? 'check_circle' : 'person'}</span>
                                                                                {hasStaff ? (isDone ? `Task completed by ${sa.staff_name}` : sa.staff_name) : (isDone ? 'All sub-tasks completed' : 'Sub-tasks assigned')}
                                                                                {!isDone && (
                                                                                    <>
                                                                                        <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>({sa.status})</span>
                                                                                        {/* Only allow removing direct staff assignment; container is managed via subtasks */}
                                                                                        {hasStaff ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="btn-close p-0 ms-1"
                                                                                                style={{ fontSize: '7px', opacity: 0.6 }}
                                                                                                onClick={() => handleRemoveAssignment(sa.id)}
                                                                                            />
                                                                                        ) : null}
                                                                                    </>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {/* Show subtask assignees under container assignment(s) */}
                                                                    {taskAssignments
                                                                        .filter((a) => String(a.staff_name ?? '').trim() === '')
                                                                        .flatMap((a) => (Array.isArray((a as any).subtasks) ? (a as any).subtasks : []))
                                                                        .map((st: any) => (
                                                                            <span
                                                                                key={`st-${st.id}`}
                                                                                className="badge d-inline-flex align-items-center gap-1"
                                                                                style={{
                                                                                    background: '#fff7ed',
                                                                                    color: '#9a3412',
                                                                                    fontSize: '0.7rem',
                                                                                    fontWeight: 500,
                                                                                }}
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>subdirectory_arrow_right</span>
                                                                                {st.assigned_to_name}
                                                                                <span className="ms-1 text-muted" style={{ fontSize: '0.65rem' }}>
                                                                                    ({st.status})
                                                                                </span>
                                                                            </span>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top-0 p-4 pt-0 d-flex justify-content-end gap-3">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary d-flex align-items-center gap-2 px-4 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
                                    title={
                                        !processDataReady
                                            ? 'Loading process tasks and assignments…'
                                            : !canViewProcesses
                                              ? 'Assign every process task before opening Processes'
                                              : undefined
                                    }
                                    disabled={!processDataReady}
                                    onClick={() => {
                                        if (!processDataReady) return;
                                        if (!canViewProcesses) {
                                            setShowAssignmentsRequiredDialog(true);
                                            return;
                                        }
                                        setShowViewModal(false);
                                        setShowAssignmentsRequiredDialog(false);
                                        const queryTitle = selectedActivity.parent_title || selectedActivity.title;
                                        router.push(`/department-head?pg=tasks&activity=${encodeURIComponent(queryTitle)}`);
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>list</span>
                                    View processes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAssignmentsRequiredDialog && (
                <div
                    className="modal fade show d-block"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="hod-assignments-required-title"
                    style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        zIndex: 1080,
                        backdropFilter: 'blur(2px)',
                    }}
                    onClick={() => setShowAssignmentsRequiredDialog(false)}
                >
                    <div
                        className="modal-dialog modal-dialog-centered modal-sm"
                        role="document"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                            <div className="modal-body p-4 text-center">
                                <div
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                                    style={{
                                        width: 48,
                                        height: 48,
                                        background: '#fff7ed',
                                        color: '#c2410c',
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                                        assignment_late
                                    </span>
                                </div>
                                <h2
                                    id="hod-assignments-required-title"
                                    className="h6 fw-bold text-dark mb-2"
                                    style={{ fontSize: '1rem' }}
                                >
                                    Assignments required
                                </h2>
                                <p className="text-secondary mb-0" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    Complete all task assignments before proceeding.
                                </p>
                            </div>
                            <div className="modal-footer border-0 justify-content-center pt-0 pb-4 px-4">
                                <button
                                    type="button"
                                    className="btn btn-primary px-4 fw-semibold"
                                    style={{ borderRadius: '8px', minWidth: '120px' }}
                                    onClick={() => setShowAssignmentsRequiredDialog(false)}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Process modal — search / multi-select like admin Responsible Office */}
            {showAssignModal && assigningTask && (
                <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15,23,42,0.7)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '640px' }}>
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                            <div className="modal-header pb-0 px-4 pt-4 border-0 align-items-start">
                                <h6 className="fw-bold d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1rem' }}>
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>person_add</span>
                                    Assign Process
                                </h6>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setShowAssignModal(false);
                                        setAssignStaffIds([]);
                                        setStaffSearchTerm('');
                                        setStaffPositionAddAll('');
                                    }}
                                />
                            </div>
                            <div className="modal-body px-4 py-3">
                                <div className="row g-3 mb-3">
                                    <div className="col-12">
                                        <div className="p-3 rounded h-100" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '0.82rem', color: '#0369a1' }}>
                                            <div className="row g-2 align-items-start">
                                                <div className="col-sm-4 text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}>
                                                    Task
                                                </div>
                                                <div className="col-sm-8 fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                                                    {(processTasks.findIndex((t) => t.id === assigningTask.id)) + 1}. {assigningTask.taskName}
                                                </div>
                                                <div className="col-sm-4 text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}>
                                                    Activity
                                                </div>
                                                <div className="col-sm-8 text-dark" style={{ fontSize: '0.82rem' }}>
                                                    {selectedActivity?.title}
                                                </div>
                                                {assigningTask.performance_indicator ? (
                                                    <>
                                                        <div className="col-sm-4 text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: '#0369a1' }}>
                                                            Indicator
                                                        </div>
                                                        <div className="col-sm-8 text-dark small" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                                                            {assigningTask.performance_indicator}
                                                        </div>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-3 p-3 rounded-3 border" style={{ background: '#ffffff' }}>
                                    <div className="d-flex align-items-start justify-content-between gap-2">
                                        <div>
                                            <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>Break down into sub-tasks (optional)</div>
                                        </div>
                                        <div className="form-check form-switch m-0">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                checked={assignBreakdownEnabled}
                                                onChange={(e) => {
                                                    const on = e.target.checked;
                                                    setAssignBreakdownEnabled(on);
                                                    if (on && assignSubtasks.length === 0) {
                                                        // Default: one subtask per selected staff, editable
                                                        const initial = assignStaffIds.map((sid) => ({
                                                            assigned_to: sid,
                                                            title: `${assigningTask.taskName} — ${departmentUsers.find((u) => u.id === sid)?.full_name ?? 'Sub-task'}`,
                                                        }));
                                                        setAssignSubtasks(initial);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {assignBreakdownEnabled && (
                                        <div className="mt-3 d-flex flex-column gap-2">
                                            {assignSubtasks.map((st, idx) => (
                                                <div key={idx} className="d-flex flex-wrap gap-2 align-items-center">
                                                    <input
                                                        className="form-control form-control-sm"
                                                        style={{ flex: 1, minWidth: 220 }}
                                                        value={st.title}
                                                        placeholder={`Sub-task #${idx + 1} title`}
                                                        onChange={(e) => {
                                                            const arr = [...assignSubtasks];
                                                            arr[idx] = { ...arr[idx], title: e.target.value };
                                                            setAssignSubtasks(arr);
                                                        }}
                                                        disabled={assignSaving}
                                                    />
                                                    <select
                                                        className="form-select form-select-sm"
                                                        style={{ width: 220 }}
                                                        value={st.assigned_to === '' ? '' : String(st.assigned_to)}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            const arr = [...assignSubtasks];
                                                            arr[idx] = { ...arr[idx], assigned_to: v === '' ? '' : Number(v) };
                                                            setAssignSubtasks(arr);
                                                        }}
                                                        disabled={assignSaving}
                                                    >
                                                        <option value="">Assign to…</option>
                                                        {assignStaffIds.map((sid) => {
                                                            const u = departmentUsers.find((x) => x.id === sid);
                                                            return (
                                                                <option key={sid} value={sid}>
                                                                    {u?.full_name || `Staff #${sid}`}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        style={{ fontSize: '.75rem' }}
                                                        onClick={() => setAssignSubtasks(assignSubtasks.filter((_, i) => i !== idx))}
                                                        disabled={assignSaving}
                                                        title="Remove sub-task"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="d-flex justify-content-between align-items-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    style={{ fontSize: '.75rem' }}
                                                    onClick={() => setAssignSubtasks([...assignSubtasks, { title: '', assigned_to: '' }])}
                                                    disabled={assignSaving}
                                                >
                                                    + Add sub-task
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    style={{ fontSize: '.75rem' }}
                                                    onClick={() => {
                                                        const auto = assignStaffIds.map((sid) => ({
                                                            assigned_to: sid,
                                                            title: `${assigningTask.taskName} — ${departmentUsers.find((u) => u.id === sid)?.full_name ?? 'Sub-task'}`,
                                                        }));
                                                        setAssignSubtasks(auto);
                                                    }}
                                                    disabled={assignSaving || assignStaffIds.length === 0}
                                                >
                                                    Auto-split (1 per staff)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="form-label fw-semibold small mb-0">Assign staff</label>
                                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>Search or bulk-add, then confirm</span>
                                </div>
                                <div className="position-relative mb-2">
                                    <input
                                        type="search"
                                        className="form-control form-control-sm"
                                        placeholder="Search staff by name or position..."
                                        value={staffSearchTerm}
                                        onChange={(e) => {
                                            setStaffSearchTerm(e.target.value);
                                            setShowStaffSearchResults(true);
                                        }}
                                        onFocus={() => setShowStaffSearchResults(true)}
                                        autoComplete="off"
                                    />
                                    {showStaffSearchResults && staffSearchResults.length > 0 && (
                                        <div
                                            className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-hidden"
                                            style={{ zIndex: 1070, maxHeight: '220px', overflowY: 'auto' }}
                                        >
                                            {staffSearchResults.map((u) => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    className="btn btn-white w-100 text-start px-2 py-2 border-bottom small d-flex flex-column align-items-start"
                                                    onClick={() => addStaffToAssign(u.id)}
                                                >
                                                    <span className="fw-medium">{u.full_name}</span>
                                                    {u.position ? (
                                                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                            {u.position}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="d-flex flex-nowrap gap-2 mb-2 align-items-center">
                                    <select
                                        className="form-select form-select-sm"
                                        style={{ width: '190px', minWidth: '190px' }}
                                        value={staffPositionAddAll}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setStaffPositionAddAll(val);
                                            if (!val) return;
                                            if (val === '__ALL__') {
                                                addAllDepartmentStaff();
                                            } else {
                                                addAllDepartmentStaffByPosition(val);
                                            }
                                        }}
                                        disabled={departmentUsers.length === 0}
                                    >
                                        <option value="">Add staff…</option>
                                        <option value="__ALL__">All staff</option>
                                        {availablePositions.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary py-0 ms-auto"
                                        style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                                        onClick={() => {
                                            setAssignStaffIds([]);
                                            setStaffSearchTerm('');
                                            setStaffPositionAddAll('');
                                        }}
                                        disabled={assignStaffIds.length === 0 && !staffSearchTerm && !staffPositionAddAll}
                                    >
                                        Clear selection
                                    </button>
                                </div>
                                <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                    {assignStaffIds.map((id) => {
                                        const u = departmentUsers.find((x) => x.id === id);
                                        return (
                                            <span
                                                key={id}
                                                className="badge bg-light text-primary border d-flex align-items-center gap-1 py-1 px-2"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                {u?.full_name || id}
                                                {u?.position ? <span className="text-muted fw-normal">({u.position})</span> : null}
                                                <span
                                                    className="material-symbols-outlined"
                                                    style={{ fontSize: '14px', cursor: 'pointer' }}
                                                    role="presentation"
                                                    onClick={() => removeStaffFromAssign(id)}
                                                >
                                                    close
                                                </span>
                                            </span>
                                        );
                                    })}
                                    {assignStaffIds.length === 0 && (
                                        <span className="text-muted small">No staff selected yet.</span>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2 justify-content-end">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => {
                                        setShowAssignModal(false);
                                        setAssignStaffIds([]);
                                        setStaffSearchTerm('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm fw-bold"
                                    style={{ background: 'var(--mubs-blue)', color: '#fff', borderColor: 'var(--mubs-blue)' }}
                                    disabled={assignStaffIds.length === 0 || assignSaving}
                                    onClick={handleAssignTask}
                                >
                                    {assignSaving ? 'Saving...' : assignStaffIds.length > 1 ? `Assign ${assignStaffIds.length} staff` : 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
