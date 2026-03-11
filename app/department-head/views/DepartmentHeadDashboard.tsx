'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatCard from '@/components/StatCard';

interface DepartmentHeadData {
    stats: {
        totalActivities: number;
        onTrack: number;
        delayed: number;
        totalTasks: number;
        pendingSubmissions: number;
        hrAlerts: number;
    };
    hrWarnings: Array<{
        full_name: string;
        role: string;
        leave_status: string;
        contract_end_date: string | null;
        daysRemaining: number | null;
    }>;
    activityProgress: Array<{
        title: string;
        status: string;
        progress: number;
        end_date: string;
    }>;
    recentSubmissions: Array<{
        staff: string;
        task: string;
        date: string;
        status: string;
    }>;
    noDepartment?: boolean;
}

export default function DepartmentHeadDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DepartmentHeadData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/department-head');
                setData(response.data);
            } catch (error: any) {
                console.error('Error fetching department head dashboard data:', error);
                setError(error.response?.data?.message || 'Failed to load department dashboard. Please try again.');
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
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Dashboard</h5>
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

    const { stats, hrWarnings, activityProgress, recentSubmissions, noDepartment } = data;

    if (noDepartment) {
        return (
            <div id="page-dashboard" className="page-section active-page">
                <div className="container py-5">
                    <div className="alert alert-info border-0 shadow-sm d-flex align-items-start gap-3 p-4" role="alert">
                        <span className="material-symbols-outlined fs-1 text-primary">info</span>
                        <div>
                            <h5 className="alert-heading fw-bold mb-2">No department assigned</h5>
                            <p className="mb-0 text-secondary">
                                Your account is not linked to a department or unit. To see activities, staff, and submissions here, an administrator must assign you to a department (e.g. Faculty of Commerce) in User Management.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="page-dashboard" className="page-section active-page">
            {/* HR Warning banner */}
            {stats.hrAlerts > 0 && (
                <div className="alert alert-warning alert-strip alert-dismissible fade show mb-4 d-flex align-items-center gap-2" role="alert">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>warning</span>
                    <div>
                        <strong>Department Warnings:</strong> {stats.hrAlerts} staff members require attention (leave or contract expiry).
                        <button type="button" className="alert-link fw-semibold btn btn-link p-0 border-0 text-decoration-underline" onClick={() => router.push('/department-head?pg=staff')}> Review staff →</button>
                    </div>
                    <button type="button" className="btn-close ms-auto" data-bs-dismiss="alert"></button>
                </div>
            )}

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment"
                        label="Strategic Activities"
                        value={stats.totalActivities}
                        badge="Assigned"
                        badgeIcon="verified"
                        color="blue"
                    />
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="task_alt"
                        label="Tasks Created"
                        value={stats.totalTasks}
                        badge="+3"
                        badgeIcon="trending_up"
                        color="green"
                    />
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="inbox"
                        label="Pending Submissions"
                        value={stats.pendingSubmissions}
                        badge="Pending"
                        badgeIcon="schedule"
                        color="yellow"
                    />
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="warning"
                        label="HR Warnings"
                        value={stats.hrAlerts}
                        badge="HR"
                        badgeIcon="person_alert"
                        color="red"
                    />
                </div>
            </div>

            <div className="row g-4">
                {/* Department progress */}
                <div className="col-12 col-lg-8">
                    <div className="table-card mb-4">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>analytics</span>
                                Department Activity Progress
                            </h5>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push('/department-head?pg=activities')}>View All</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Activity</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityProgress.map((act, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="activity-icon">
                                                        <span className="material-symbols-outlined">
                                                            {act.title.toLowerCase().includes('computer') ? 'computer' :
                                                                act.title.toLowerCase().includes('digital') ? 'laptop' :
                                                                    act.title.toLowerCase().includes('curriculum') ? 'code' : 'school'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '.85rem', maxWidth: '250px' }}>{act.title}</div>
                                                        <div className="text-muted" style={{ fontSize: '.72rem' }}>Due {act.end_date ? new Date(act.end_date).toLocaleDateString() : 'TBD'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="status-badge" style={{
                                                    background: act.status === 'On Track' ? '#dcfce7' : (act.status === 'In Progress' ? '#fef9c3' : '#fee2e2'),
                                                    color: act.status === 'On Track' ? '#15803d' : (act.status === 'In Progress' ? '#a16207' : '#b91c1c')
                                                }}>{act.status}</span>
                                            </td>
                                            <td style={{ minWidth: '120px' }}>
                                                <div className="progress-bar-custom">
                                                    <div className="progress-bar-fill" style={{
                                                        width: `${act.progress}%`,
                                                        background: act.progress >= 75 ? '#10b981' : (act.progress >= 40 ? '#005696' : '#e31837')
                                                    }}></div>
                                                </div>
                                                <span style={{ fontSize: '.72rem', color: '#64748b' }}>{act.progress}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent submissions quick */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>inbox</span>
                                Recent Submissions
                            </h5>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push('/department-head?pg=submissions')}>View All</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table mb-0">
                                <thead>
                                    <tr>
                                        <th>Staff</th>
                                        <th>Report / Task</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSubmissions.map((sub, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="staff-avatar" style={{ background: index % 3 === 0 ? '#7c3aed' : (index % 3 === 1 ? '#059669' : '#b45309') }}>
                                                        {sub.staff.split(' ').map(n => n[0]).join('')}
                                                    </div>
                                                    <span className="fw-bold text-dark" style={{ fontSize: '.83rem' }}>{sub.staff}</span>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '.83rem' }}>{sub.task}</td>
                                            <td style={{ fontSize: '.8rem', color: '#64748b' }}>{sub.date}</td>
                                            <td>
                                                <span className="status-badge" style={{
                                                    background: sub.status === 'Reviewed' ? '#dcfce7' : '#fef9c3',
                                                    color: sub.status === 'Reviewed' ? '#15803d' : '#a16207'
                                                }}>{sub.status}</span>
                                            </td>
                                            <td>
                                                <button type="button" className="btn btn-xs btn-primary py-0 px-2 fw-bold" style={{ fontSize: '.75rem', background: 'var(--mubs-blue)' }} onClick={() => router.push(sub.status === 'Reviewed' ? '/department-head?pg=evaluations' : '/department-head?pg=submissions')}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{sub.status === 'Reviewed' ? 'visibility' : 'rate_review'}</span>
                                                    {sub.status === 'Reviewed' ? ' View' : ' Review'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="col-12 col-lg-4 d-flex flex-column gap-4">
                    {/* HR Warnings */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-red)' }}>warning</span>
                                System Warnings
                            </h5>
                            <span className="badge bg-danger">{hrWarnings.length} Active</span>
                        </div>
                        <div className="p-3">
                            {hrWarnings.map((warn, index) => (
                                <div key={index} className="warn-card" style={{ background: warn.leave_status !== 'On Duty' ? '#fff1f2' : '#fffbeb' }}>
                                    <div className="warn-icon" style={{ background: warn.leave_status !== 'On Duty' ? '#fee2e2' : '#fef3c7' }}>
                                        <span className="material-symbols-outlined" style={{ color: warn.leave_status !== 'On Duty' ? '#e31837' : '#b45309' }}>
                                            {warn.leave_status !== 'On Duty' ? 'person_off' : 'badge'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="warn-title">{warn.full_name} — {warn.leave_status !== 'On Duty' ? warn.leave_status : 'Contract Expiring'}</div>
                                        <div className="warn-meta">
                                            {warn.leave_status !== 'On Duty' ? `Staff is currently on ${warn.leave_status.toLowerCase()}.` :
                                                `Contract ends ${warn.contract_end_date ? new Date(warn.contract_end_date).toLocaleDateString() : 'soon'}. ${warn.daysRemaining} days remaining.`}
                                        </div>
                                        <button className="btn btn-xs btn-outline-secondary mt-1 py-0 px-2 fw-bold" style={{ fontSize: '.72rem' }}>Details</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="table-card">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>bolt</span>
                                Quick Actions
                            </h5>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <button type="button" className="btn btn-outline-primary fw-bold text-start d-flex align-items-center gap-2" onClick={() => router.push('/department-head?pg=tasks')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>add_task</span>
                                Create Sub-Activity / Task
                            </button>
                            <button type="button" className="btn btn-outline-primary fw-bold text-start d-flex align-items-center gap-2" onClick={() => router.push('/department-head?pg=tasks')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>assignment_ind</span>
                                Assign Task to Staff
                            </button>
                            <button type="button" className="btn btn-outline-warning fw-bold text-start d-flex align-items-center gap-2 text-dark" onClick={() => router.push('/department-head?pg=submissions')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>inbox</span>
                                Review Submissions
                                <span className="badge bg-warning text-dark ms-auto">{stats.pendingSubmissions}</span>
                            </button>
                            <button type="button" className="btn btn-outline-danger fw-bold text-start d-flex align-items-center gap-2" onClick={() => router.push('/department-head?pg=staff')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-red)' }}>warning</span>
                                View HR Warnings
                                <span className="badge bg-danger ms-auto">{stats.hrAlerts}</span>
                            </button>
                            <button type="button" className="btn btn-outline-success fw-bold text-start d-flex align-items-center gap-2" onClick={() => router.push('/department-head?pg=evaluations')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#059669' }}>rate_review</span>
                                Evaluate Staff Reports
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
