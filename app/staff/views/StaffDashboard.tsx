"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface DashboardData {
    stats: {
        assigned: number;
        overdue: number;
        inProgress: number;
        completed: number;
    };
    deadlines: any[];
    feedback: any[];
}

export default function StaffDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/staff');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching staff dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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

    const stats = data?.stats || { assigned: 0, overdue: 0, inProgress: 0, completed: 0 };
    const deadlines = data?.deadlines || [];
    const feedbackList = data?.feedback || [];

    return (
        <div className="content-area w-100">
            {/* Welcome banner */}
            <div className="p-4 mb-4 rounded-4" style={{
                background: 'linear-gradient(135deg, var(--mubs-blue) 0%, var(--mubs-navy) 100%)',
                border: '1px solid rgba(255,255,255,.1)',
                boxShadow: '0 8px 32px rgba(0, 86, 150, 0.15)'
            }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-3 mb-1">
                            <div className="profile-avatar text-white fw-bold d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px', fontSize: '1.2rem', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>JA</div>
                            <div>
                                <div className="fw-black text-white" style={{ fontSize: '1.25rem' }}>Welcome back, Jane 👋</div>
                                <div className="text-white-50" style={{ fontSize: '.85rem' }}>Lecturer · Faculty of Computing · FY 2024–25</div>
                            </div>
                        </div>
                    </div>
                    <div className="text-end">
                        <div className="text-white-50" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em' }}>My Completion Rate</div>
                        <div className="fw-black text-white" style={{ fontSize: '2.5rem', lineHeight: '1' }}>
                            {stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0}%
                        </div>
                        <div style={{ width: '160px', height: '8px', background: 'rgba(255,255,255,.2)', borderRadius: '99px', overflow: 'hidden', marginTop: '6px' }}>
                            <div style={{
                                width: `${stats.assigned > 0 ? (stats.completed / stats.assigned) * 100 : 0}%`,
                                height: '100%',
                                background: 'var(--mubs-yellow)',
                                borderRadius: '99px',
                                transition: 'width 1s ease-in-out'
                            }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="inventory"
                        label="Total Tasks"
                        value={stats.assigned}
                        badge={`${stats.completed} Completed`}
                        badgeIcon="task_alt"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="pending_actions"
                        label="In Progress"
                        value={stats.inProgress}
                        badge="Active"
                        badgeIcon="sync"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="notification_important"
                        label="Overdue"
                        value={stats.overdue}
                        badge="Requires Action"
                        badgeIcon="warning"
                        color="red"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="grade"
                        label="Average Score"
                        value={data?.averageScore != null ? String(data.averageScore) : '—'}
                        badge={data?.averageScore != null ? (data.averageScore >= 4 ? 'Excellent' : data.averageScore >= 3 ? 'Good' : 'Improving') : 'No ratings'}
                        badgeIcon="verified"
                        color="green"
                    />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <Link href="/staff?pg=submit" className="text-decoration-none h-100">
                        <div className="quick-action-card p-3 d-flex align-items-center gap-3 bg-white border rounded-4 shadow-sm h-100" style={{ transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}>
                            <div className="icon-box d-flex align-items-center justify-content-center" style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(0, 86, 150, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '24px' }}>add_task</span>
                            </div>
                            <div>
                                <div className="fw-black text-dark" style={{ fontSize: '1rem' }}>Submit Report</div>
                                <div className="text-muted small">Update progress on tasks</div>
                            </div>
                        </div>
                    </Link>
                </div>
                <div className="col-12 col-md-4">
                    <Link href="/staff?pg=tasks" className="text-decoration-none h-100">
                        <div className="quick-action-card p-3 d-flex align-items-center gap-3 bg-white border rounded-4 shadow-sm h-100" style={{ transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}>
                            <div className="icon-box d-flex align-items-center justify-content-center" style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '24px' }}>list_alt</span>
                            </div>
                            <div>
                                <div className="fw-black text-dark" style={{ fontSize: '1rem' }}>View My Tasks</div>
                                <div className="text-muted small">Manage assigned activities</div>
                            </div>
                        </div>
                    </Link>
                </div>
                <div className="col-12 col-md-4">
                    <Link href="/staff?pg=deadlines" className="text-decoration-none h-100">
                        <div className="quick-action-card p-3 d-flex align-items-center gap-3 bg-white border rounded-4 shadow-sm h-100" style={{ transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}>
                            <div className="icon-box d-flex align-items-center justify-content-center" style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(227, 24, 55, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '24px' }}>event_note</span>
                            </div>
                            <div>
                                <div className="fw-black text-dark" style={{ fontSize: '1rem' }}>Check Deadlines</div>
                                <div className="text-muted small">Review upcoming due dates</div>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            <div className="row g-4">
                {/* Task quick view */}
                <div className="col-12 col-lg-7">
                    <div className="table-card mb-4" style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(0, 86, 150, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                        borderRadius: '20px'
                    }}>
                        <div className="table-card-header p-4" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <div className="d-flex align-items-center gap-3">
                                <div style={{
                                    width: '36px', height: '36px',
                                    background: 'linear-gradient(135deg, var(--mubs-blue), var(--mubs-navy))',
                                    borderRadius: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(0, 86, 150, 0.2)'
                                }}>
                                    <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>rocket_launch</span>
                                </div>
                                <h5 className="mb-0 fw-black" style={{ color: 'var(--mubs-navy)', fontSize: '1.1rem' }}>Today's Focus Areas</h5>
                            </div>
                            <Link href="/staff?pg=tasks" className="btn btn-sm btn-link text-decoration-none fw-black p-0" style={{ fontSize: '.8rem', color: 'var(--mubs-blue)' }}>View All <span className="material-symbols-outlined align-middle" style={{ fontSize: '16px' }}>arrow_forward</span></Link>
                        </div>
                        <div className="p-4">
                            {deadlines.slice(0, 2).map((item, index) => (
                                <div key={index} className="focus-premium-card mb-3 p-3 rounded-4" style={{
                                    background: item.status === 'Delayed' ? 'linear-gradient(to right, #fff5f5, #ffffff)' : 'linear-gradient(to right, #f0f9ff, #ffffff)',
                                    border: item.status === 'Delayed' ? '1px solid #fee2e2' : '1px solid #e0f2fe',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div className="d-flex align-items-start gap-3">
                                        <div className="activity-icon-premium" style={{
                                            width: '56px', height: '56px',
                                            borderRadius: '16px',
                                            background: item.status === 'Delayed' ? '#fee2e2' : '#e0f2fe',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: item.status === 'Delayed' ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 4px 12px rgba(14, 165, 233, 0.1)'
                                        }}>
                                            <span className="material-symbols-outlined" style={{
                                                color: item.status === 'Delayed' ? '#dc2626' : '#0284c7',
                                                fontSize: '28px'
                                            }}>{item.status === 'Delayed' ? 'warning' : 'task_alt'}</span>
                                        </div>
                                        <div className="flex-fill">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <div className="fw-black text-dark text-truncate" style={{ fontSize: '1rem', maxWidth: '250px' }}>{item.title}</div>
                                                <span className="badge rounded-pill" style={{
                                                    background: item.status === 'Delayed' ? '#fee2e2' : '#dcfce7',
                                                    color: item.status === 'Delayed' ? '#b91c1c' : '#15803d',
                                                    fontSize: '.65rem', fontWeight: '800'
                                                }}>{item.status.toUpperCase()}</span>
                                            </div>
                                            <div className="text-muted mb-2 text-truncate" style={{ fontSize: '.8rem' }}>{item.description}</div>
                                            <div className="progress-container mb-1" style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${item.progress}%`,
                                                    height: '100%',
                                                    background: item.status === 'Delayed' ? 'linear-gradient(to right, #ef4444, #f87171)' : 'linear-gradient(to right, #0ea5e9, #38bdf8)',
                                                    borderRadius: '4px'
                                                }}></div>
                                            </div>
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                                <span className="text-muted fw-bold" style={{ fontSize: '.7rem' }}>
                                                    <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '14px' }}>calendar_today</span>
                                                    Due {new Date(item.dueDate).toLocaleDateString()}
                                                </span>
                                                <Link href="/staff?pg=submit" className="btn btn-sm fw-black text-white px-3 shadow-sm align-middle" style={{
                                                    background: item.status === 'Delayed' ? 'var(--mubs-red)' : 'var(--mubs-blue)',
                                                    borderRadius: '8px',
                                                    fontSize: '.75rem'
                                                }}>UPDATE</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {deadlines.length === 0 && (
                                <div className="text-center py-4">
                                    <span className="material-symbols-outlined text-muted" style={{ fontSize: '48px' }}>eco</span>
                                    <p className="text-muted mt-2">No focus areas for today. You're all caught up!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="col-12 col-lg-5 d-flex flex-column gap-4">
                    {/* Upcoming deadlines */}
                    <div className="table-card" style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(227, 24, 55, 0.05)',
                        borderRadius: '20px'
                    }}>
                        <div className="table-card-header p-4">
                            <div className="d-flex align-items-center gap-3">
                                <div style={{
                                    width: '36px', height: '36px',
                                    background: 'rgba(227, 24, 55, 0.1)',
                                    borderRadius: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--mubs-red)', fontSize: '22px' }}>timer</span>
                                </div>
                                <h5 className="mb-0 fw-black" style={{ color: 'var(--mubs-navy)', fontSize: '1.1rem' }}>Upcoming Deadlines</h5>
                            </div>
                            <Link href="/staff?pg=deadlines" className="btn btn-sm btn-link text-decoration-none fw-black p-0" style={{ fontSize: '.8rem', color: 'var(--mubs-red)' }}>All</Link>
                        </div>
                        <div className="p-4 pt-0">
                            <div className="d-flex flex-column gap-3">
                                {deadlines.slice(0, 3).map((item, index) => (
                                    <div key={index} className="deadline-tile p-3 rounded-4 shadow-sm" style={{ background: 'white', border: '1px solid #f1f5f9', transition: 'transform 0.2s' }}>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span className="badge" style={{
                                                background: item.daysLeft <= 2 ? '#fee2e2' : '#fef3c7',
                                                color: item.daysLeft <= 2 ? '#b91c1c' : '#92400e',
                                                fontSize: '.6rem', fontWeight: '900'
                                            }}>{item.daysLeft <= 0 ? 'OVERDUE' : (item.daysLeft <= 2 ? 'URGENT' : 'SOON')}</span>
                                            <span style={{
                                                fontSize: '.7rem',
                                                color: item.daysLeft <= 2 ? '#b91c1c' : '#64748b',
                                                fontWeight: '800'
                                            }}>{item.daysLeft <= 0 ? Math.abs(item.daysLeft) + ' DAYS LATE' : 'IN ' + item.daysLeft + ' DAYS'}</span>
                                        </div>
                                        <div className="fw-black text-dark mb-1 text-truncate" style={{ fontSize: '.9rem' }}>{item.title}</div>
                                        <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '.75rem' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                                            Due {new Date(item.dueDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Latest feedback */}
                    <div className="table-card overflow-hidden" style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(16, 185, 129, 0.05)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                        borderRadius: '20px'
                    }}>
                        <div className="table-card-header p-4">
                            <div className="d-flex align-items-center gap-3">
                                <div style={{
                                    width: '36px', height: '36px',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '22px' }}>auto_awesome</span>
                                </div>
                                <h5 className="mb-0 fw-black" style={{ color: 'var(--mubs-navy)', fontSize: '1.1rem' }}>Latest Feedback</h5>
                            </div>
                            <Link href="/staff?pg=feedback" className="btn btn-sm btn-link text-decoration-none fw-black p-0" style={{ fontSize: '.8rem', color: '#059669' }}>View All</Link>
                        </div>
                        <div className="p-4 pt-0">
                            {feedbackList.map((feedback, index) => (
                                <div key={feedback.id ?? index} className="feedback-premium-card p-3 rounded-4 mb-3" style={{
                                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                                    border: '1px solid #dcfce7',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="fw-black text-dark text-truncate" style={{ fontSize: '.9rem', maxWidth: '180px' }}>{feedback.task}</div>
                                        <div className="d-flex align-items-center gap-1">
                                            <span className="fw-black" style={{ color: '#15803d', fontSize: '1rem' }}>{(feedback.score ?? 0).toFixed(1)}</span>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#fbbf24', fontVariationSettings: "'FILL' 1" }}>star</span>
                                        </div>
                                    </div>
                                    <p className="mb-2" style={{ fontSize: '.8rem', color: '#166534', lineHeight: '1.5', opacity: 0.8 }}>
                                        Keep up the standard. Progress is visible.
                                    </p>
                                    <div className="d-flex align-items-center justify-content-between border-top pt-2 mt-2" style={{ borderColor: 'rgba(21, 128, 61, 0.1)' }}>
                                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '.6rem' }}>{feedback.status}</span>
                                        <span className="text-muted" style={{ fontSize: '.65rem' }}>{feedback.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
