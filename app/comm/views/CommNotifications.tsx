"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';

interface NotifItem {
    id: number;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    is_urgent: boolean;
    action_url?: string;
    created_at: string;
}

export default function CommNotifications() {
    const [list, setList] = useState<NotifItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/staff/notifications?filter=${filter}`);
                setList(Array.isArray(res.data?.notifications) ? res.data.notifications : []);
            } catch (e) {
                console.error('Notifications fetch error', e);
                setList([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filter]);

    const markAllRead = async () => {
        try {
            await axios.patch('/api/staff/notifications', { markAllRead: true });
            setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch {
            alert('Failed to mark all as read.');
        }
    };

    const formatDate = (d: string) => {
        const date = new Date(d);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 86400000) return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        if (diff < 172800000) return `Yesterday, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const iconStyle = (type: string) => {
        if (type === 'success' || type === 'approval') return { bg: '#dcfce7', color: '#059669' };
        if (type === 'warning') return { bg: '#fffbeb', color: '#b45309' };
        if (type === 'error' || type === 'rejection') return { bg: '#fee2e2', color: 'var(--mubs-red)' };
        return { bg: '#f5f3ff', color: '#7c3aed' };
    };

    return (
        <div className="content-area-comm">
            <div className="row g-4">
                <div className="mb-3">
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5><span className="material-symbols-outlined me-2" style={{ color: '#7c3aed' }}>notifications</span>All Notifications</h5>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={markAllRead}>Mark all read</button>
                                <select className="form-select form-select-sm" style={{ width: '130px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
                                    <option value="All">All</option>
                                    <option value="Unread">Unread</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            {loading ? (
                                <div className="p-4 text-center text-muted">Loading…</div>
                            ) : list.length === 0 ? (
                                <div className="p-4 text-center text-muted">No notifications.</div>
                            ) : (
                                list.map((n) => {
                                    const style = iconStyle(n.type);
                                    return (
                                        <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                                            <div className="notif-icon" style={{ background: style.bg }}><span className="material-symbols-outlined" style={{ color: style.color }}>{n.type === 'rejection' || n.type === 'error' ? 'cancel' : n.type === 'approval' || n.type === 'success' ? 'check_circle' : 'info'}</span></div>
                                            <div className="flex-fill">
                                                <div className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{n.title}</div>
                                                <div className="text-muted" style={{ fontSize: '.73rem' }}>{n.message}</div>
                                                <div className="text-muted" style={{ fontSize: '.71rem', marginTop: '2px' }}>{formatDate(n.created_at)}</div>
                                            </div>
                                            {!n.is_read && <div className="unread-dot"></div>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
