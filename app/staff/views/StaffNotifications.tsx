"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function iconAndBg(type: string) {
    switch (type) {
        case 'success': return { icon: 'check_circle', bg: '#ecfdf5', color: '#059669' };
        case 'warning': return { icon: 'schedule', bg: '#fffbeb', color: '#b45309' };
        case 'danger': return { icon: 'event_busy', bg: '#fff1f2', color: 'var(--mubs-red)' };
        default: return { icon: 'info', bg: '#eff6ff', color: 'var(--mubs-blue)' };
    }
}

export default function StaffNotifications() {
    const [notifications, setNotifications] = useState<Notif[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);

    const fetchNotifs = async () => {
        try {
            const params = filter !== 'All' ? `?filter=${encodeURIComponent(filter)}` : '';
            const res = await axios.get(`/api/staff/notifications${params}`);
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount ?? 0);
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifs();
    }, [filter]);

    const markAllRead = async () => {
        try {
            await axios.patch('/api/staff/notifications', { markAllRead: true });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (e) {
            console.error('Failed to mark all read', e);
        }
    };

    const taskCount = notifications.filter(n => n.title.toLowerCase().includes('task') || n.type === 'info').length;
    const feedbackCount = notifications.filter(n => n.type === 'success' || n.title.toLowerCase().includes('evaluat') || n.title.toLowerCase().includes('feedback')).length;

    return (
        <div className="content-area w-100">
            <div className="row g-4">
                <div className="col-12 col-lg-8">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>notifications</span>All Notifications</h5>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={markAllRead}>Mark all read</button>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: '130px' }}
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                >
                                    <option value="All">All</option>
                                    <option value="Unread">Unread</option>
                                    <option value="Tasks">Tasks</option>
                                    <option value="Deadlines">Deadlines</option>
                                    <option value="Feedback">Feedback</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            {loading ? (
                                <div className="p-4 text-center text-muted">Loading...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-4 text-center text-muted">No notifications.</div>
                            ) : (
                                notifications.map(n => {
                                    const { icon, bg, color } = iconAndBg(n.type);
                                    return (
                                        <div key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`}>
                                            <div className="notif-icon" style={{ background: bg }}>
                                                <span className="material-symbols-outlined" style={{ color }}>{icon}</span>
                                            </div>
                                            <div className="flex-fill">
                                                <div className="notif-title">{n.title}</div>
                                                {n.message && <div className="notif-meta">{n.message}</div>}
                                                <div className="notif-meta mt-1">{formatNotifDate(n.created_at)}</div>
                                            </div>
                                            {!n.is_read && <div className="unread-dot"></div>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-4">
                    <div className="table-card">
                        <div className="table-card-header"><h5><span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>inbox</span>Notification Stats</h5></div>
                        <div className="p-4">
                            <div className="d-flex flex-column gap-3">
                                <div>
                                    <div className="d-flex justify-content-between mb-1"><span style={{ fontSize: '.82rem', fontWeight: '700', color: '#0f172a' }}>Unread</span><span className="fw-black" style={{ color: 'var(--mubs-blue)' }}>{unreadCount}</span></div>
                                    <div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: `${notifications.length ? Math.min(100, (unreadCount / notifications.length) * 100) : 0}%`, background: 'var(--mubs-blue)' }}></div></div>
                                </div>
                                <div>
                                    <div className="d-flex justify-content-between mb-1"><span style={{ fontSize: '.82rem', fontWeight: '700', color: '#0f172a' }}>Task Alerts</span><span className="fw-black" style={{ color: '#b45309' }}>{taskCount}</span></div>
                                    <div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: `${notifications.length ? (taskCount / notifications.length) * 100 : 0}%`, background: 'var(--mubs-yellow)' }}></div></div>
                                </div>
                                <div>
                                    <div className="d-flex justify-content-between mb-1"><span style={{ fontSize: '.82rem', fontWeight: '700', color: '#0f172a' }}>Feedback</span><span className="fw-black" style={{ color: '#059669' }}>{feedbackCount}</span></div>
                                    <div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: `${notifications.length ? (feedbackCount / notifications.length) * 100 : 0}%`, background: '#10b981' }}></div></div>
                                </div>
                                <div>
                                    <div className="d-flex justify-content-between mb-1"><span style={{ fontSize: '.82rem', fontWeight: '700', color: '#0f172a' }}>Total</span><span className="fw-black" style={{ color: '#64748b' }}>{notifications.length}</span></div>
                                    <div className="progress-bar-custom"><div className="progress-bar-fill" style={{ width: '100%', background: '#94a3b8' }}></div></div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 rounded" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                <div className="fw-bold text-dark mb-1" style={{ fontSize: '.83rem' }}>Notification Settings</div>
                                <div className="form-check form-switch mb-1">
                                    <input className="form-check-input" type="checkbox" defaultChecked id="sw1" />
                                    <label className="form-check-label" htmlFor="sw1" style={{ fontSize: '.78rem' }}>Email notifications</label>
                                </div>
                                <div className="form-check form-switch mb-1">
                                    <input className="form-check-input" type="checkbox" defaultChecked id="sw2" />
                                    <label className="form-check-label" htmlFor="sw2" style={{ fontSize: '.78rem' }}>Deadline reminders</label>
                                </div>
                                <div className="form-check form-switch">
                                    <input className="form-check-input" type="checkbox" id="sw3" />
                                    <label className="form-check-label" htmlFor="sw3" style={{ fontSize: '.78rem' }}>SMS alerts</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
