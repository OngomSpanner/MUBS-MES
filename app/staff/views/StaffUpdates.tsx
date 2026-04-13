"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';

import StatCard from '@/components/StatCard';

interface Task {
    id: number;
    title: string;
    unit_name: string;
    dueDate: string;
    status: string;
    daysLeft: number;
}

interface DeadlineStats {
    assigned: number;
    overdue: number;
    inProgress: number;
    completed: number;
}

interface Notif {
    id: number;
    title: string;
    message: string | null;
    type: string;
    is_read: boolean;
    is_urgent: boolean;
    action_url: string | null;
    created_at: string;
}

function formatNotifDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iconAndBg(type: string) {
    switch (type) {
        case 'success': return { icon: 'check_circle', bg: '#ecfdf5', color: '#059669' };
        case 'warning': return { icon: 'schedule', bg: '#fffbeb', color: '#b45309' };
        case 'danger': return { icon: 'event_busy', bg: '#fff1f2', color: 'var(--mubs-red)' };
        default: return { icon: 'info', bg: '#eff6ff', color: 'var(--mubs-blue)' };
    }
}

export default function StaffUpdates() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stats, setStats] = useState<DeadlineStats>({ assigned: 0, overdue: 0, inProgress: 0, completed: 0 });
    const [notifications, setNotifications] = useState<Notif[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'notifications' | 'deadlines'>('notifications');
    const [notifFilter, setNotifFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => { setCurrentPage(1); }, [activeTab, notifFilter]);

    const fetchData = async () => {
        try {
            const [tasksRes, notifsRes] = await Promise.all([
                axios.get('/api/staff/tasks'),
                axios.get(`/api/staff/notifications${notifFilter !== 'All' ? `?filter=${encodeURIComponent(notifFilter)}` : ''}`)
            ]);
            setTasks(tasksRes.data.tasks || []);
            setStats(tasksRes.data.stats || { assigned: 0, overdue: 0, inProgress: 0, completed: 0 });
            setNotifications(notifsRes.data.notifications || []);
            setUnreadCount(notifsRes.data.unreadCount ?? 0);
        } catch (error) {
            console.error('Error fetching staff updates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [notifFilter]);

    const markAllRead = async () => {
        try {
            await axios.patch('/api/staff/notifications', { markAllRead: true });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (e) {
            console.error('Failed to mark all read', e);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const upcomingDeadlines = tasks
        .filter(t => t.status !== 'Completed')
        .sort((a, b) => a.daysLeft - b.daysLeft);

    // Pagination
    const pagedNotifs = notifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const pagedTasks = upcomingDeadlines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalNotifPages = Math.ceil(notifications.length / itemsPerPage);
    const totalTaskPages = Math.ceil(upcomingDeadlines.length / itemsPerPage);
    const totalPages = activeTab === 'notifications' ? totalNotifPages : totalTaskPages;

    const PaginationBar = () => totalPages <= 1 ? null : (
        <div className="p-4 border-top d-flex justify-content-between align-items-center bg-white" style={{ borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
            <div className="text-muted fw-bold" style={{ fontSize: '0.75rem' }}>
                Showing <span className="text-dark">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="text-dark">{Math.min(currentPage * itemsPerPage, activeTab === 'notifications' ? notifications.length : upcomingDeadlines.length)}</span> of{' '}
                <span className="text-dark">{activeTab === 'notifications' ? notifications.length : upcomingDeadlines.length}</span>
            </div>
            <div className="d-flex gap-2">
                <button
                    className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                    style={{ width: '32px', height: '32px', borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1 }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                        key={page}
                        className={`btn btn-sm fw-bold d-flex align-items-center justify-content-center p-0 ${currentPage === page ? 'btn-primary shadow-sm' : 'btn-outline-light border text-dark'}`}
                        style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.75rem' }}
                        onClick={() => setCurrentPage(page)}
                    >
                        {page}
                    </button>
                ))}
                <button
                    className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                    style={{ width: '32px', height: '32px', borderRadius: '8px', opacity: currentPage === totalPages ? 0.5 : 1 }}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="content-area w-100">
            {/* Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="notifications_active"
                        label="Notifications"
                        value={notifications.length}
                        badge={`${unreadCount} Unread`}
                        badgeIcon="mark_chat_unread"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment_late"
                        label="Overdue Tasks"
                        value={stats.overdue}
                        badge="Requires Action"
                        badgeIcon="priority_high"
                        color="red"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="event_upcoming"
                        label="Due This Week"
                        value={upcomingDeadlines.length}
                        badge="Upcoming"
                        badgeIcon="schedule"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="check_circle"
                        label="Completed"
                        value={stats.completed}
                        badge="All time"
                        badgeIcon="done_all"
                        color="green"
                    />
                </div>
            </div>

            {/* Unified Card */}
            <div className="table-card p-0 overflow-hidden" style={{ borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                {/* Header */}
                <div className="table-card-header d-flex justify-content-between align-items-center p-4" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    <h5 className="mb-0 d-flex align-items-center gap-2 fw-bold" style={{ color: 'var(--mubs-navy)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>hub</span>
                        Notifications & Deadlines
                    </h5>
                    {activeTab === 'notifications' && (
                        <div className="d-flex align-items-center gap-2">
                            <select
                                className="form-select form-select-sm border-0 bg-light rounded-3"
                                style={{ width: '120px', fontSize: '.75rem', fontWeight: 700 }}
                                value={notifFilter}
                                onChange={(e) => setNotifFilter(e.target.value)}
                            >
                                <option value="All">All Types</option>
                                <option value="Unread">Unread</option>
                                <option value="Tasks">Tasks</option>
                                <option value="Deadlines">Deadlines</option>
                            </select>
                            {unreadCount > 0 && (
                                <button
                                    className="btn btn-sm btn-outline-primary fw-bold d-flex align-items-center gap-1"
                                    style={{ borderRadius: '8px', fontSize: '.75rem' }}
                                    onClick={markAllRead}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>done_all</span>
                                    Mark all read
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="d-flex px-4 pt-2 bg-white border-bottom gap-4">
                    <button
                        className={`pb-2 px-1 fw-bold border-0 bg-transparent position-relative ${activeTab === 'notifications' ? 'text-primary' : 'text-muted'}`}
                        style={{ fontSize: '0.85rem', transition: 'all 0.2s' }}
                        onClick={() => setActiveTab('notifications')}
                    >
                        Notifications
                        <span className="badge rounded-pill ms-2" style={{ background: '#eff6ff', color: 'var(--mubs-blue)', fontSize: '0.65rem' }}>
                            {unreadCount > 0 ? `${unreadCount} new` : notifications.length}
                        </span>
                        {activeTab === 'notifications' && <div className="position-absolute bottom-0 start-0 w-100 bg-primary" style={{ height: '3px', borderRadius: '3px 3px 0 0' }}></div>}
                    </button>
                    <button
                        className={`pb-2 px-1 fw-bold border-0 bg-transparent position-relative ${activeTab === 'deadlines' ? 'text-primary' : 'text-muted'}`}
                        style={{ fontSize: '0.85rem', transition: 'all 0.2s' }}
                        onClick={() => setActiveTab('deadlines')}
                    >
                        Upcoming Deadlines
                        {stats.overdue > 0 && (
                            <span className="badge rounded-pill ms-2" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.65rem' }}>
                                {stats.overdue} overdue
                            </span>
                        )}
                        {activeTab === 'deadlines' && <div className="position-absolute bottom-0 start-0 w-100 bg-primary" style={{ height: '3px', borderRadius: '3px 3px 0 0' }}></div>}
                    </button>
                </div>

                {/* Tab Content: Notifications */}
                {activeTab === 'notifications' && (
                    <div>
                        {notifications.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '40px', opacity: 0.3 }}>notifications_off</span>
                                No notifications found.
                            </div>
                        ) : (
                            pagedNotifs.map(n => {
                                const { icon, bg, color } = iconAndBg(n.type);
                                return (
                                    <div
                                        key={n.id}
                                        className="d-flex align-items-start gap-3 p-4 border-bottom"
                                        style={{ background: n.is_read ? 'transparent' : '#f8faff', transition: 'background 0.2s' }}
                                    >
                                        <div className="d-flex align-items-center justify-content-center flex-shrink-0" style={{ background: bg, width: '40px', height: '40px', borderRadius: '12px' }}>
                                            <span className="material-symbols-outlined" style={{ color, fontSize: '20px' }}>{icon}</span>
                                        </div>
                                        <div className="flex-fill">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{n.title}</div>
                                                <div className="d-flex align-items-center gap-2">
                                                    {!n.is_read && <div className="bg-primary rounded-circle" style={{ width: '8px', height: '8px', flexShrink: 0 }}></div>}
                                                    <span className="text-muted" style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}>{formatNotifDate(n.created_at)}</span>
                                                </div>
                                            </div>
                                            {n.message && <div className="text-muted mt-1" style={{ fontSize: '.8rem' }}>{n.message}</div>}
                                            {n.is_urgent && (
                                                <span className="badge mt-2" style={{ background: '#fff1f2', color: '#b91c1c', fontSize: '0.65rem' }}>
                                                    urgent
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <PaginationBar />
                    </div>
                )}

                {/* Tab Content: Deadlines */}
                {activeTab === 'deadlines' && (
                    <div className="table-responsive">
                        <table className="table mb-0 align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Task</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th className="pe-4 text-end">Timeline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcomingDeadlines.length > 0 ? (
                                    pagedTasks.map(task => {
                                            const isOverdue = task.daysLeft < 0;
                                            const isDueSoon = task.daysLeft >= 0 && task.daysLeft <= 3;
                                            return (
                                                <tr key={task.id} style={{ background: isOverdue ? '#fff9f9' : 'transparent' }}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>{task.title}</div>
                                                        <div className="text-muted" style={{ fontSize: '.72rem' }}>{task.unit_name || 'N/A'}</div>
                                                    </td>
                                                    <td style={{ fontSize: '.82rem', fontWeight: 700, color: isOverdue ? 'var(--mubs-red)' : isDueSoon ? '#b45309' : '#0f172a' }}>
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </td>
                                                    <td>
                                                        <span className="status-badge" style={{
                                                            background: isOverdue ? '#fee2e2' : task.status === 'Completed' ? '#dcfce7' : '#f1f5f9',
                                                            color: isOverdue ? '#b91c1c' : task.status === 'Completed' ? '#15803d' : '#475569'
                                                        }}>
                                                            {isOverdue ? 'Overdue' : task.status}
                                                        </span>
                                                    </td>
                                                    <td className="pe-4 text-end">
                                                        <span className="badge rounded-pill fw-bold" style={{
                                                            background: isOverdue ? '#fee2e2' : isDueSoon ? '#fef3c7' : '#f1f5f9',
                                                            color: isOverdue ? '#b91c1c' : isDueSoon ? '#92400e' : '#475569',
                                                            fontSize: '.72rem'
                                                        }}>
                                                            {task.daysLeft < 0 ? `${Math.abs(task.daysLeft)}d late` : `${task.daysLeft}d left`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-5 text-muted">
                                            <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '40px', opacity: 0.3 }}>event_available</span>
                                            No upcoming deadlines.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <PaginationBar />
            </div>
        </div>
    );
}
