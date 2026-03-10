"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Task {
    id: number;
    title: string;
    unit_name: string;
    dueDate: string;
    status: string;
    daysLeft: number;
}

interface Stats {
    assigned: number;
    overdue: number;
    inProgress: number;
    completed: number;
}

export default function StaffDeadlines() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stats, setStats] = useState<Stats>({ assigned: 0, overdue: 0, inProgress: 0, completed: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const response = await axios.get('/api/staff/tasks');
                setTasks(response.data.tasks);
                setStats(response.data.stats);
            } catch (error) {
                console.error('Error fetching staff deadlines:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
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

    const onTimePercentage = stats.assigned > 0 ? Math.round(((stats.assigned - stats.overdue) / stats.assigned) * 100) : 100;
    const strokeDasharray = 295;
    const strokeDashoffset = strokeDasharray - (strokeDasharray * onTimePercentage) / 100;

    return (
        <div className="content-area w-100">
            <div className="row g-4">
                <div className="col-12 col-lg-8">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>schedule</span>All Deadlines</h5>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>Department</th>
                                        <th>Due Date</th>
                                        <th>Status</th>
                                        <th>Timeline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.length > 0 ? (
                                        tasks.map(task => {
                                            const isOverdue = task.daysLeft < 0 && task.status !== 'Completed';
                                            const isDueSoon = task.daysLeft >= 0 && task.daysLeft <= 3 && task.status !== 'Completed';

                                            return (
                                                <tr key={task.id} style={{ background: isOverdue ? '#fff1f2' : (isDueSoon ? '#fffbeb' : 'transparent') }}>
                                                    <td><div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{task.title}</div></td>
                                                    <td style={{ fontSize: '.78rem', color: '#64748b' }}>{task.unit_name || 'N/A'}</td>
                                                    <td style={{
                                                        fontSize: '.82rem',
                                                        fontWeight: '700',
                                                        color: isOverdue ? 'var(--mubs-red)' : (isDueSoon ? '#b45309' : '#0f172a')
                                                    }}>
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </td>
                                                    <td>
                                                        <span className="status-badge" style={{
                                                            background: isOverdue ? '#fee2e2' : (task.status === 'Completed' ? '#dcfce7' : '#f1f5f9'),
                                                            color: isOverdue ? '#b91c1c' : (task.status === 'Completed' ? '#15803d' : '#475569')
                                                        }}>
                                                            {isOverdue ? 'Overdue' : task.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="deadline-pill" style={{
                                                            background: isOverdue ? '#fee2e2' : (task.status === 'Completed' ? '#dcfce7' : '#e2e8f0'),
                                                            color: isOverdue ? '#b91c1c' : (task.status === 'Completed' ? '#15803d' : '#475569')
                                                        }}>
                                                            {task.status === 'Completed' ? 'Done' : (task.daysLeft < 0 ? `${Math.abs(task.daysLeft)}d late` : `${task.daysLeft} days`)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="text-center p-4 text-muted">No deadlines found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Deadline summary */}
                <div className="col-12 col-lg-4">
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>insights</span>Deadline Summary</h5></div>
                        <div className="p-4">
                            <div className="text-center mb-4">
                                <div className="perf-ring mb-2" style={{ position: 'relative', display: 'inline-block' }}>
                                    <svg width="110" height="110" viewBox="0 0 110 110">
                                        <circle cx="55" cy="55" r="47" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                                        <circle
                                            cx="55" cy="55" r="47"
                                            fill="none" stroke={onTimePercentage >= 80 ? "#10b981" : (onTimePercentage >= 50 ? "var(--mubs-yellow)" : "var(--mubs-red)")}
                                            strokeWidth="10"
                                            strokeDasharray={strokeDasharray}
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                        />
                                    </svg>
                                    <div className="perf-ring-label" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>{onTimePercentage}%</div>
                                        <div style={{ fontSize: '.65rem', color: '#64748b', fontWeight: '700' }}>Compliance</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '.8rem', color: '#64748b' }}>
                                    {stats.assigned - stats.overdue} of {stats.assigned} tasks on track
                                </div>
                            </div>
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: '#fff1f2' }}>
                                    <span style={{ fontSize: '.82rem', fontWeight: '700', color: '#b91c1c' }}>Overdue Tasks</span>
                                    <span className="fw-black" style={{ color: 'var(--mubs-red)' }}>{stats.overdue}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: '#fffbeb' }}>
                                    <span style={{ fontSize: '.82rem', fontWeight: '700', color: '#a16207' }}>In Progress</span>
                                    <span className="fw-black" style={{ color: '#b45309' }}>{stats.inProgress}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: '#f0fdf4' }}>
                                    <span style={{ fontSize: '.82rem', fontWeight: '700', color: '#15803d' }}>Completed</span>
                                    <span className="fw-black" style={{ color: '#059669' }}>{stats.completed}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
