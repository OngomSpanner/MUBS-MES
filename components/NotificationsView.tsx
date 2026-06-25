'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { dispatchNotificationsChanged } from '@/hooks/useUnreadNotificationCount';
import StatCard from '@/components/StatCard';

export interface Notif {
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
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function iconAndBg(type: string) {
  switch (type) {
    case 'success':
      return { icon: 'check_circle', bg: '#ecfdf5', color: '#059669' };
    case 'warning':
      return { icon: 'schedule', bg: '#fffbeb', color: '#b45309' };
    case 'danger':
      return { icon: 'event_busy', bg: '#fff1f2', color: 'var(--mubs-red)' };
    default:
      return { icon: 'info', bg: '#eff6ff', color: 'var(--mubs-blue)' };
  }
}

export default function NotificationsView({ showDeadlineFilters = true }: { showDeadlineFilters?: boolean }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const params = filter !== 'All' ? `?filter=${encodeURIComponent(filter)}` : '';
      const res = await axios.get(`/api/notifications${params}`);
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount ?? 0);
      dispatchNotificationsChanged();
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchNotifs();
  }, [filter]);

  const markAllRead = async () => {
    try {
      await axios.patch('/api/notifications', { markAllRead: true });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      dispatchNotificationsChanged();
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const markOneRead = async (id: number) => {
    try {
      await axios.patch('/api/notifications', { id });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      dispatchNotificationsChanged();
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  const taskCount = notifications.filter(
    (n) => n.title.toLowerCase().includes('task') || n.type === 'info'
  ).length;
  const feedbackCount = notifications.filter(
    (n) =>
      n.type === 'success' ||
      n.title.toLowerCase().includes('evaluat') ||
      n.title.toLowerCase().includes('feedback') ||
      n.title.toLowerCase().includes('indicator') ||
      n.title.toLowerCase().includes('performance')
  ).length;

  return (
    <div className="w-100">
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Unread" value={unreadCount} color="blue" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Task alerts" value={taskCount} color="red" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Feedback" value={feedbackCount} color="green" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Total" value={notifications.length} color="yellow" />
        </div>
      </div>

      <div className="table-card">
            <div className="table-card-header">
              <h5>
                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                  notifications
                </span>
                All Notifications
              </h5>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void markAllRead()}>
                  Mark all read
                </button>
                <select
                  className="form-select form-select-sm"
                  style={{ width: '130px' }}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Unread">Unread</option>
                  {showDeadlineFilters ? (
                    <>
                      <option value="Tasks">Tasks</option>
                      <option value="Deadlines">Deadlines</option>
                    </>
                  ) : null}
                  <option value="Feedback">Feedback</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-4 text-center text-muted">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-5 text-center text-muted">
                <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.35 }}>
                  notifications_off
                </span>
                No notifications yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 notif-table">
                  <thead>
                    <tr>
                      <th className="ps-4" style={{ width: '56px' }} />
                      <th className="px-3">Notification</th>
                      <th className="px-3 text-nowrap" style={{ width: '120px' }}>
                        When
                      </th>
                      <th className="pe-4 text-end" style={{ width: '140px' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => {
                      const { icon, bg, color } = iconAndBg(n.type);
                      const rowClass = n.is_read ? '' : 'notif-table-row--unread';

                      const onRowActivate = () => {
                        if (!n.is_read) void markOneRead(n.id);
                      };

                      const goToAction = () => {
                        onRowActivate();
                        if (n.action_url) router.push(n.action_url);
                      };

                      return (
                        <tr
                          key={n.id}
                          className={rowClass}
                          role={n.action_url ? 'link' : 'button'}
                          tabIndex={0}
                          style={{ cursor: n.action_url ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (n.action_url) goToAction();
                            else onRowActivate();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (n.action_url) goToAction();
                              else onRowActivate();
                            }
                          }}
                        >
                          <td className="ps-4 py-3">
                            <div
                              className="d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: bg,
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ color, fontSize: '22px' }}>
                                {icon}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="d-flex align-items-start gap-2">
                              {!n.is_read ? (
                                <span
                                  className="rounded-circle flex-shrink-0 mt-1"
                                  style={{ width: '8px', height: '8px', background: 'var(--mubs-blue)' }}
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>
                                  {n.title}
                                </div>
                                {n.message ? (
                                  <div className="text-muted mt-1" style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                                    {n.message}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted text-nowrap" style={{ fontSize: '0.78rem' }}>
                            {formatNotifDate(n.created_at)}
                          </td>
                          <td className="pe-4 py-3 text-end">
                            {n.action_url ? (
                              <Link
                                href={n.action_url}
                                className="fw-semibold text-decoration-none"
                                style={{ fontSize: '0.8rem', color: 'var(--mubs-blue)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!n.is_read) void markOneRead(n.id);
                                }}
                              >
                                View →
                              </Link>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  );
}
