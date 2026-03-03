'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Task {
    id: number;
    title: string;
    status: string;
    priority: string;
    progress: number;
    dueDate: string;
    assignee_name: string;
    assigned_to?: number;
    activity_title: string;
    activity_id?: number;
    description?: string;
    reviewer_notes?: string;
}

interface KanbanData {
    kanban: {
        todo: Task[];
        inProgress: Task[];
        underReview: Task[];
        completed: Task[];
    };
    filters: {
        activities: string[];
        assignees: string[];
    };
}

interface UnitTasksProps {
    initialActivity?: string;
}

export default function UnitTasks({ initialActivity }: UnitTasksProps) {
    const [data, setData] = useState<KanbanData | null>(null);
    const [availableActivities, setAvailableActivities] = useState<{ id: number, title: string }[]>([]);
    const [departmentUsers, setDepartmentUsers] = useState<{ id: number, full_name: string, role: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activityFilter, setActivityFilter] = useState(initialActivity || 'All Strategic Activities');
    const [assigneeFilter, setAssigneeFilter] = useState('All Assignees');

    // Modal States
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showEvaluateModal, setShowEvaluateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [taskForm, setTaskForm] = useState<Partial<Task>>({
        priority: 'Medium'
    });
    const [evaluateForm, setEvaluateForm] = useState({ id: 0, status: 'Completed', notes: '' });

    const fetchData = async () => {
        try {
            const [tasksRes, usersRes] = await Promise.all([
                axios.get('/api/unit-head/tasks'),
                axios.get('/api/users/department')
            ]);
            setData(tasksRes.data.kanban ? tasksRes.data : { ...tasksRes.data, kanban: { todo: [], inProgress: [], underReview: [], completed: [] } });
            setAvailableActivities(tasksRes.data.availableActivities || []);
            setDepartmentUsers(usersRes.data || []);
        } catch (error: any) {
            console.error('Error fetching unit tasks data:', error);
            setError(error.response?.data?.message || 'Failed to load tasks data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
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

    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Tasks</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const filterTasks = (tasks: Task[]) => {
        return tasks.filter(t => {
            const matchesActivity = activityFilter === 'All Strategic Activities' || t.activity_title === activityFilter;
            const matchesAssignee = assigneeFilter === 'All Assignees' || t.assignee_name === assigneeFilter;
            return matchesActivity && matchesAssignee;
        });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const handleOpenCreate = () => {
        setTaskForm({ priority: 'Medium', status: 'Not Started' });
        setShowTaskModal(true);
    };

    const handleOpenEdit = (task: Task) => {
        setTaskForm({ ...task });
        setShowTaskModal(true);
    };

    const handleOpenEvaluate = (task: Task) => {
        setEvaluateForm({ id: task.id, status: 'Completed', notes: task.reviewer_notes || '' });
        setShowEvaluateModal(true);
    };

    const handleSaveTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (taskForm.id) {
                await axios.put('/api/unit-head/tasks', { ...taskForm });
            } else {
                await axios.post('/api/unit-head/tasks', {
                    title: taskForm.title,
                    parent_id: taskForm.activity_id,
                    assigned_to: taskForm.assigned_to,
                    end_date: taskForm.dueDate,
                    priority: taskForm.priority,
                    description: taskForm.description
                });
            }
            setShowTaskModal(false);
            await fetchData();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Failed to save task. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEvaluateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.put('/api/unit-head/tasks', {
                id: evaluateForm.id,
                status: evaluateForm.status,
                reviewer_notes: evaluateForm.notes,
                progress: evaluateForm.status === 'Completed' ? 100 : undefined
            });
            setShowEvaluateModal(false);
            await fetchData();
        } catch (error) {
            console.error('Error evaluating task:', error);
            alert('Failed to evaluate task. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        { key: 'todo', label: 'To Do', color: '#64748b', bg: '#f1f5f9', tasks: filterTasks(data.kanban.todo) },
        { key: 'inProgress', label: 'In Progress', color: '#b45309', bg: '#fef9c3', tasks: filterTasks(data.kanban.inProgress) },
        { key: 'underReview', label: 'Under Review', color: '#1d4ed8', bg: '#eff6ff', tasks: filterTasks(data.kanban.underReview) },
        { key: 'completed', label: 'Completed', color: '#15803d', bg: '#ecfdf5', tasks: filterTasks(data.kanban.completed) }
    ];

    return (
        <div id="page-tasks" className="page-section active-page">
            <div className="table-card shadow-sm mb-4">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>view_kanban</span>
                        Unit Tasks Kanban Board
                    </h5>
                    <div className="d-flex gap-3 flex-wrap align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <span className="material-symbols-outlined text-muted" style={{ fontSize: '18px' }}>filter_list</span>
                            <span className="fw-bold text-dark small">Filters:</span>
                        </div>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '220px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value)}
                        >
                            <option>All Strategic Activities</option>
                            {data.filters.activities.map(a => <option key={a}>{a}</option>)}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '180px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                        >
                            <option>All Assignees</option>
                            {data.filters.assignees.map(a => <option key={a}>{a}</option>)}
                        </select>
                        <button
                            className="btn btn-sm btn-primary d-flex align-items-center gap-2 ms-auto fw-bold shadow-sm"
                            style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                            onClick={handleOpenCreate}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span> New Task
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3" style={{ minHeight: 'calc(100vh - 250px)' }}>
                {columns.map(col => (
                    <div className="col-12 col-md-6 col-xl-3" key={col.key}>
                        <div className="kanban-column rounded-3 p-3 h-100 border shadow-sm" style={{ background: col.bg, borderColor: `${col.color}20` }}>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h6 className="fw-black mb-0" style={{ color: col.color, fontSize: '.9rem', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                                    {col.label}
                                </h6>
                                <span className="badge rounded-pill" style={{ background: `${col.color}20`, color: col.color, fontSize: '.75rem' }}>
                                    {col.tasks.length}
                                </span>
                            </div>

                            <div className="d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                                {col.tasks.length === 0 ? (
                                    <div className="text-center py-4 text-muted small border border-dashed rounded bg-white bg-opacity-50">
                                        No tasks here
                                    </div>
                                ) : (
                                    col.tasks.map(task => (
                                        <div key={task.id} className="kanban-card p-3 bg-white rounded-3 shadow-sm border" style={{
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                            borderLeft: `4px solid ${task.priority === 'High' ? 'var(--mubs-red)' : (task.priority === 'Medium' ? 'var(--mubs-yellow)' : '#10b981')}`
                                        }}>
                                            <div className="d-flex justify-content-between mb-2 align-items-start">
                                                <span className={`badge ${task.priority === 'High' ? 'bg-danger-subtle text-danger' : (task.priority === 'Medium' ? 'bg-warning-subtle text-dark' : 'bg-success-subtle text-success')}`} style={{ fontSize: '.6rem', fontWeight: 800 }}>
                                                    {task.priority.toUpperCase()}
                                                </span>
                                                <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '.65rem' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>calendar_today</span>
                                                    {formatDate(task.dueDate)}
                                                </div>
                                            </div>

                                            <div className="fw-bold text-dark mb-1" style={{ fontSize: '.83rem', lineHeight: '1.4' }}>{task.title}</div>
                                            <div className="text-muted mb-2 overflow-hidden text-truncate w-100" style={{ fontSize: '.72rem' }}>{task.activity_title}</div>

                                            {task.status === 'In Progress' && (
                                                <div className="progress mb-3" style={{ height: '5px', borderRadius: '10px' }}>
                                                    <div className="progress-bar" style={{
                                                        width: `${task.progress}%`,
                                                        background: task.progress > 75 ? '#10b981' : (task.progress > 30 ? '#f59e0b' : '#3b82f6'),
                                                        borderRadius: '10px'
                                                    }}></div>
                                                </div>
                                            )}

                                            <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-light">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="staff-avatar" style={{
                                                        background: 'var(--mubs-blue)',
                                                        width: '24px',
                                                        height: '24px',
                                                        fontSize: '.65rem',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#fff',
                                                        fontWeight: 'bold',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                    }} title={task.assignee_name || 'Unassigned'}>
                                                        {task.assignee_name?.split(' ').map(n => n[0]).join('') || '?'}
                                                    </div>
                                                    <span className="fw-semibold text-dark" style={{ fontSize: '.7rem' }}>{task.assignee_name?.split(' ')[0] || 'Unassigned'}</span>
                                                </div>
                                                <div className="d-flex gap-1">
                                                    {col.key === 'underReview' ? (
                                                        <button
                                                            className="btn btn-xs btn-primary py-0 px-2 fw-bold shadow-sm"
                                                            style={{ fontSize: '.65rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEvaluate(task); }}
                                                        >Evaluate</button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-xs btn-light bg-opacity-50 py-0 px-2 border"
                                                            style={{ fontSize: '.65rem', color: '#64748b' }}
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Task Modal UI */}
            {showTaskModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            <div className={`modal fade ${showTaskModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header border-bottom-0 pb-0">
                            <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">{taskForm.id ? 'edit_square' : 'add_task'}</span>
                                {taskForm.id ? 'Edit Task' : 'Create New Task'}
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setShowTaskModal(false)}></button>
                        </div>
                        <div className="modal-body p-4">
                            <form onSubmit={handleSaveTask} id="taskForm">
                                <div className="row g-3">
                                    <div className="col-12">
                                        <label className="form-label fw-semibold small mb-1">Task Title <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" required value={taskForm.title || ''} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="E.g. Identify 5 new vendors" />
                                    </div>
                                    <div className="col-md-12">
                                        <label className="form-label fw-semibold small mb-1">Parent Strategic Activity <span className="text-danger">*</span></label>
                                        <select className="form-select" required value={taskForm.activity_id || ''} onChange={(e) => setTaskForm({ ...taskForm, activity_id: parseInt(e.target.value) })}>
                                            <option value="">-- Select Parent Activity --</option>
                                            {availableActivities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold small mb-1">Assign To</label>
                                        <select className="form-select" value={taskForm.assigned_to || ''} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: parseInt(e.target.value) || undefined })}>
                                            <option value="">Unassigned</option>
                                            {departmentUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-semibold small mb-1">Due Date <span className="text-danger">*</span></label>
                                        <input type="date" className="form-control" required value={taskForm.dueDate ? new Date(taskForm.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-semibold small mb-1">Priority</label>
                                        <select className="form-select" value={taskForm.priority || 'Medium'} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label fw-semibold small mb-1">Task Description / Instructions</label>
                                        <textarea className="form-control" rows={3} value={taskForm.description || ''} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Detailed requirements for the assignee..."></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer bg-light border-top-0 py-3">
                            <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setShowTaskModal(false)}>Cancel</button>
                            <button type="submit" form="taskForm" className="btn btn-primary fw-bold px-4 shadow-sm" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Task'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Evaluate Modal UI */}
            {showEvaluateModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            <div className={`modal fade ${showEvaluateModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header border-bottom-0 pb-0">
                            <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">rate_review</span>
                                Evaluate Task Submission
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setShowEvaluateModal(false)}></button>
                        </div>
                        <div className="modal-body p-4">
                            <form onSubmit={handleEvaluateTask} id="evaluateForm">
                                <div className="mb-4 p-3 bg-light rounded border border-info border-opacity-25">
                                    <p className="small text-muted mb-1">The assignee has submitted this task for your review. Provide feedback and determine the final outcome.</p>
                                </div>

                                <label className="form-label fw-semibold small mb-2">Review Outcome <span className="text-danger">*</span></label>
                                <div className="d-flex gap-3 mb-4">
                                    <label className={`btn ${evaluateForm.status === 'Completed' ? 'btn-success' : 'btn-outline-success'} flex-fill d-flex flex-column align-items-center gap-1 p-3`}>
                                        <input type="radio" name="status" className="d-none" checked={evaluateForm.status === 'Completed'} onChange={() => setEvaluateForm({ ...evaluateForm, status: 'Completed' })} />
                                        <span className="material-symbols-outlined">check_circle</span>
                                        <span className="fw-bold small">Approve & Complete</span>
                                    </label>
                                    <label className={`btn ${evaluateForm.status === 'In Progress' ? 'btn-warning text-dark border-warning' : 'btn-outline-warning text-dark'} flex-fill d-flex flex-column align-items-center gap-1 p-3`}>
                                        <input type="radio" name="status" className="d-none" checked={evaluateForm.status === 'In Progress'} onChange={() => setEvaluateForm({ ...evaluateForm, status: 'In Progress' })} />
                                        <span className="material-symbols-outlined">replay</span>
                                        <span className="fw-bold small">Return for Edits</span>
                                    </label>
                                </div>

                                <div className="mb-0">
                                    <label className="form-label fw-semibold small mb-1">Reviewer Feedback / Comments</label>
                                    <textarea className="form-control" rows={3} value={evaluateForm.notes || ''} onChange={(e) => setEvaluateForm({ ...evaluateForm, notes: e.target.value })} placeholder="Required if returning for edits..."></textarea>
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer bg-light border-top-0 py-3">
                            <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setShowEvaluateModal(false)}>Cancel</button>
                            <button type="submit" form="evaluateForm" className="btn btn-primary fw-bold px-4 shadow-sm" style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Submit Evaluation'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
