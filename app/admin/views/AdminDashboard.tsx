"use client";

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import CreateUserModal from '@/components/Modals/CreateUserModal';
import CreateActivityModal from '@/components/Modals/CreateActivityModal';
import EnrollmentFacultyBreakdown from '@/components/Enrollment/EnrollmentFacultyBreakdown';
import axios from 'axios';

interface DashboardStats {
    totalActivities: number;
    overallProgress: number;
    totalUsers: number;
    activeUsers: number;
    completedActivities: number;
    onTrackActivities: number;
    pendingProposals: number;
    delayedActivities: number;
    hrAlertCount: number;
    enrollmentProgrammes?: number;
    enrollmentProgrammeStudents?: number;
    enrollmentCourseUnits?: number;
    enrollmentCourseUnitStudents?: number;
    enrollmentPwdStudents?: number;
    rfIndicators?: number;
    rfAssessed?: number;
    rfUnderperformance?: number;
    rfAchievement?: number;
    rfOverachievement?: number;
    rfNarrativesMissing?: number;
}

interface HRAlert {
    id: number;
    full_name: string;
    role: string;
    date: string;
    type: string;
    message: string;
    color: string;
}

interface DepartmentPerformance {
    name: string;
    progress: number;
}

interface RecentActivity {
    icon: string;
    bgColor: string;
    iconColor: string;
    description: string;
    timestamp: string;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalActivities: 0,
        overallProgress: 0,
        totalUsers: 0,
        activeUsers: 0,
        completedActivities: 0,
        onTrackActivities: 0,
        pendingProposals: 0,
        delayedActivities: 0,
        hrAlertCount: 0
    });
    const [departmentPerformance, setUnitPerformance] = useState<DepartmentPerformance[]>([]);
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [hrAlerts, setHrAlerts] = useState<HRAlert[]>([]);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);

    async function fetchDashboardData() {
        try {
            const response = await axios.get('/api/dashboard/stats');
            setStats(response.data.stats);
            setUnitPerformance(response.data.departmentPerformance);
            setRecentActivities(response.data.recentActivities);
            setHrAlerts(response.data.hrAlerts || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }

    useEffect(() => {
        void fetchDashboardData();
    }, []);

    return (
        <Layout>


            {/* Stat Cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment"
                        label="Total Activities"
                        value={stats.totalActivities}
                        badge={`${stats.completedActivities} Completed`}
                        badgeIcon="task_alt"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="analytics"
                        label="Overall Progress"
                        value={`${stats.overallProgress}%`}
                        badge={`${stats.onTrackActivities} On Track`}
                        badgeIcon="trending_up"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="group"
                        label="System Users"
                        value={stats.totalUsers}
                        badge={`${stats.activeUsers} Active`}
                        badgeIcon="check_circle"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="schedule"
                        label="Delayed Activities"
                        value={stats.delayedActivities}
                        badge={
                            stats.totalActivities > 0
                                ? `${Math.round((stats.delayedActivities / stats.totalActivities) * 100)}% of total`
                                : '0% of total'
                        }
                        badgeIcon="trending_down"
                        color="red"
                    />
                </div>
            </div>

            {(stats.rfIndicators ?? 0) > 0 ? (
                <div className="row g-3 mb-4">
                    <div className="col-12">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="fw-bold text-dark mb-0">Results Framework (university-wide)</h6>
                            <a href="/admin?pg=reports&tab=results-framework" className="small fw-bold text-decoration-none">
                                View details →
                            </a>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="analytics" label="RF indicators" value={stats.rfIndicators ?? 0} badge="FY" badgeIcon="calendar_today" color="blue" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="trending_down" label="Underperformance" value={stats.rfUnderperformance ?? 0} badge="Watch" badgeIcon="warning" color="red" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="task_alt" label="Achievement" value={stats.rfAchievement ?? 0} badge="On target" badgeIcon="check" color="green" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard
                            icon="edit_note"
                            label="Missing narratives"
                            value={stats.rfNarrativesMissing ?? 0}
                            badge="Ambassador"
                            badgeIcon="rate_review"
                            color="yellow"
                        />
                    </div>
                </div>
            ) : null}

            {(stats.enrollmentProgrammes ?? 0) > 0 || (stats.enrollmentCourseUnits ?? 0) > 0 ? (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-12">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <h6 className="fw-bold text-dark mb-0">Student enrollment indicators</h6>
                                <a href="/reports" className="small fw-bold text-decoration-none">
                                    View reports →
                                </a>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <StatCard
                                icon="school"
                                label="Programmes"
                                value={stats.enrollmentProgrammes ?? 0}
                                badge={`${stats.enrollmentProgrammeStudents ?? 0} students`}
                                badgeIcon="groups"
                                color="blue"
                            />
                        </div>
                        <div className="col-6 col-md-3">
                            <StatCard
                                icon="library_books"
                                label="Course units"
                                value={stats.enrollmentCourseUnits ?? 0}
                                badge={`${stats.enrollmentCourseUnitStudents ?? 0} students`}
                                badgeIcon="menu_book"
                                color="green"
                            />
                        </div>
                        <div className="col-6 col-md-3">
                            <StatCard
                                icon="groups"
                                label="Programme students"
                                value={stats.enrollmentProgrammeStudents ?? 0}
                                badge="Total"
                                badgeIcon="analytics"
                                color="yellow"
                            />
                        </div>
                        <div className="col-6 col-md-3">
                            <StatCard
                                icon="accessible"
                                label="PwD (programme + CU)"
                                value={stats.enrollmentPwdStudents ?? 0}
                                badge="Recorded"
                                badgeIcon="verified"
                                color="red"
                            />
                        </div>
                    </div>
                    <EnrollmentFacultyBreakdown />
                </>
            ) : null}

            <div className="row g-4">
                {/* Quick Actions */}
                <div className="col-12 col-md-4">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                                    bolt
                                </span>
                                Quick Actions
                            </h5>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            <button
                                className="btn btn-outline-primary fw-bold text-start d-flex align-items-center gap-2"
                                onClick={() => setShowCreateUserModal(true)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>
                                    person_add
                                </span>
                                Create New User
                            </button>
                            <button
                                className="btn btn-outline-primary fw-bold text-start d-flex align-items-center gap-2"
                                onClick={() => setShowCreateActivityModal(true)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-blue)' }}>
                                    add_task
                                </span>
                                Add Strategic Activity
                            </button>
                            <a href="/committee" className="btn btn-outline-warning fw-bold text-start d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>
                                    rate_review
                                </span>
                                Review Proposals
                                {stats.pendingProposals > 0 && (
                                    <span className="badge bg-warning text-dark ms-auto">{stats.pendingProposals}</span>
                                )}
                            </a>
                            <a href="/admin?pg=reports" className="btn btn-outline-danger fw-bold text-start d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--mubs-red)' }}>
                                    warning
                                </span>
                                View Delayed Activities
                                <span className="badge bg-danger ms-auto">{stats.delayedActivities}</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* HR Alerts */}
                <div className="col-12 col-md-4">
                    <div className="table-card p-0 h-100" style={{ borderTop: stats.hrAlertCount > 0 ? '4px solid var(--mubs-red)' : '1px solid #e2e8f0' }}>
                        <div className="table-card-header" style={{ background: stats.hrAlertCount > 0 ? '#fff1f2' : 'transparent' }}>
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: stats.hrAlertCount > 0 ? 'var(--mubs-red)' : '#64748b' }}>
                                    assignment_late
                                </span>
                                Critical HR Alerts
                                {stats.hrAlertCount > 0 && (
                                    <span className="badge bg-danger ms-auto">{stats.hrAlertCount}</span>
                                )}
                            </h5>
                        </div>
                        <div className="p-3">
                            {hrAlerts.length > 0 ? (
                                <div className="d-flex flex-column gap-3">
                                    {hrAlerts.map((alert) => (
                                        <div key={`${alert.type}-${alert.id}`} className="warn-card p-2" style={{ background: '#f8fafc', borderLeft: `3px solid ${alert.color}`, borderRadius: '4px' }}>
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <div className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '.8rem' }}>
                                                    {alert.full_name}
                                                </div>
                                                <span className="badge" style={{ background: alert.type === 'Contract' ? '#fef3c7' : '#dcfce7', color: alert.color, fontSize: '.65rem' }}>
                                                    {alert.type}
                                                </span>
                                            </div>
                                            <div className="text-dark fw-bold" style={{ fontSize: '.75rem' }}>{alert.message}</div>
                                            <div className="text-muted" style={{ fontSize: '.7rem' }}>{alert.role}</div>
                                        </div>
                                    ))}
                                    <button className="btn btn-sm btn-outline-secondary w-100 mt-2" style={{ fontSize: '.75rem' }} onClick={() => { window.location.href = '/admin?pg=users'; }}>
                                        Manage Roster
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '32px', opacity: 0.3 }}>check_circle</span>
                                    <div style={{ fontSize: '.8rem' }}>No urgent HR alerts</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Office/Faculty Performance */}
                <div className="col-12 col-md-4">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                                    corporate_fare
                                </span>
                                Office/Faculty Performance Overview
                            </h5>
                        </div>
                        <div className="p-3">
                            {departmentPerformance.length === 0 ? (
                                <div className="text-center py-3 text-muted" style={{ fontSize: '.85rem' }}>
                                    No office/faculty data yet.
                                </div>
                            ) : (
                                departmentPerformance.map((department, index) => {
                                    const pct = Math.min(100, Math.max(0, department.progress));
                                    const barColor = pct >= 70 ? '#005696' : pct >= 50 ? '#ffcd00' : '#e31837';
                                    return (
                                        <div className="department-bar-row mb-3" key={index}>
                                            <div className="d-flex justify-content-between mb-1" style={{ fontSize: '.75rem' }}>
                                                <span className="fw-bold text-truncate me-2">{department.name}</span>
                                                <span className="text-nowrap">{pct}%</span>
                                            </div>
                                            <div
                                                className="department-bar-track"
                                                style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}
                                            >
                                                <div
                                                    className="department-bar-fill"
                                                    style={{
                                                        width: `${pct}%`,
                                                        minWidth: pct > 0 ? '4px' : 0,
                                                        height: '100%',
                                                        background: barColor,
                                                        borderRadius: '4px',
                                                        transition: 'width 0.2s ease'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <button className="btn btn-sm btn-outline-secondary w-100 mt-2" style={{ fontSize: '.75rem' }} onClick={() => { window.location.href = '/reports'; }}>
                                View All Reports
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="col-12">
                    <div className="table-card p-0">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                                    history
                                </span>
                                Recent System Activity
                            </h5>
                        </div>
                        <div className="p-4">
                            {recentActivities.map((activity, index) => (
                                <div className="timeline-item" key={index}>
                                    <div className="timeline-dot" style={{ background: activity.bgColor }}>
                                        <span className="material-symbols-outlined" style={{ color: activity.iconColor }}>
                                            {activity.icon}
                                        </span>
                                    </div>
                                    <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>
                                        {activity.description}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '.75rem' }}>
                                        {activity.timestamp}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <CreateUserModal
                show={showCreateUserModal}
                onHide={() => setShowCreateUserModal(false)}
                onUserCreated={fetchDashboardData}
            />
            <CreateActivityModal
                show={showCreateActivityModal}
                onHide={() => setShowCreateActivityModal(false)}
                onActivityCreated={fetchDashboardData}
                mode="create"
            />
        </Layout>
    );
}
