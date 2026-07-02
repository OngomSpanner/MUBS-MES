'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import StatCard from '@/components/StatCard';
import { Badge } from 'react-bootstrap';
import { usePortalFeatures } from '@/components/PortalFeaturesProvider';
import {
  AMBASSADOR_MENU_FEATURE_KEYS,
  AMBASSADOR_REPORTING_TAB_FEATURE_KEYS,
  AMBASSADOR_TRACKING_TAB_FEATURE_KEYS,
  isFeatureEnabled,
} from '@/lib/portal-features';
import type { AssignmentRow } from '@/lib/admin/ambassador-reports-aggregate';
import type { AmbassadorInsight, AmbassadorQuestionnaireProgress } from '@/lib/ambassador/questionnaire-progress';
import { HOD_REVIEW_STATUS_LABELS } from '@/lib/hod-review-workflow-constants';

const quickActionHover = {
    onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
    },
    onMouseOut: (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    },
};

interface AmbassadorData {
    managedUnitName: string;
    canManageHrWorkforce?: boolean;
    canManageEnrollment?: boolean;
    stats: {
        totalActivities: number;
        overallProgress: number;
        complianceRate: number;
        onTrack: number;
        inProgress: number;
        delayed: number;
        requiresAttention: number;
        totalUnits: number;
        departmentsReportedThisMonth: number;
        rfIndicators?: number;
        rfAssessed?: number;
        rfUnderperformance?: number;
        rfAchievement?: number;
        rfOverachievement?: number;
        enrollmentProgrammes?: number;
        enrollmentProgrammeStudents?: number;
        enrollmentCourseUnits?: number;
        enrollmentCourseUnitStudents?: number;
    };
    subUnits: Array<{ id: number; name: string; progress: number; activityCount: number }>;
    questionnaireProgress?: AmbassadorQuestionnaireProgress;
}

const PROGRESS_LABELS: Record<AssignmentRow['progressStatus'], string> = {
  'not-started': 'Not started',
  partial: 'In progress',
  complete: 'Complete',
};

const CATEGORY_BADGE: Record<AssignmentRow['reportingCategory'], { bg: string; label: string }> = {
  'not-completed': { bg: 'secondary', label: 'Action needed' },
  'awaiting-review': { bg: 'info', label: 'Awaiting HOD' },
  completed: { bg: 'success', label: 'Approved' },
  'needs-revision': { bg: 'danger', label: 'Returned' },
};

function insightStyle(type: AmbassadorInsight['type']) {
  if (type === 'action') return { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', color: '#b45309' };
  if (type === 'success') return { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', color: '#047857' };
  return { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', color: '#1d4ed8' };
}

type ReportingQuickCard = {
    href: string;
    title: string;
    subtitle: string;
    icon: string;
    iconColor: string;
    iconBg: string;
};

function reportingQuickCard(data: AmbassadorData): ReportingQuickCard {
    if (data.canManageEnrollment && !data.canManageHrWorkforce) {
        return {
            href: '/ambassador?pg=reporting&tab=programme-enrollment',
            title: 'Enrollment',
            subtitle: 'Reporting · programmes & course units',
            icon: 'school',
            iconColor: 'var(--mubs-blue)',
            iconBg: 'rgba(0, 86, 150, 0.1)',
        };
    }
    if (data.canManageHrWorkforce) {
        return {
            href: '/ambassador?pg=reporting&tab=benefits',
            title: 'HR & workforce',
            subtitle: 'Reporting · benefits & assessments',
            icon: 'groups',
            iconColor: '#0d9488',
            iconBg: 'rgba(13, 148, 136, 0.1)',
        };
    }
    return {
        href: '/ambassador?pg=reporting&tab=data-collection',
        title: 'Performance indicators',
        subtitle: 'Reporting · unit questionnaire data',
        icon: 'bar_chart',
        iconColor: 'var(--mubs-blue)',
        iconBg: 'rgba(0, 86, 150, 0.1)',
    };
}

export default function AmbassadorDashboard() {
    const [data, setData] = useState<AmbassadorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { flags: portalFlags } = usePortalFeatures();

    const showResultsTracking = isFeatureEnabled(portalFlags, AMBASSADOR_TRACKING_TAB_FEATURE_KEYS.results);
    const showComplianceTracking = isFeatureEnabled(portalFlags, AMBASSADOR_TRACKING_TAB_FEATURE_KEYS.compliance);
    const showReportingMenu = isFeatureEnabled(portalFlags, AMBASSADOR_MENU_FEATURE_KEYS.reporting);
    const showProposeChanges = isFeatureEnabled(portalFlags, AMBASSADOR_MENU_FEATURE_KEYS['propose-changes']);
    const showEnrollmentReporting = isFeatureEnabled(portalFlags, AMBASSADOR_REPORTING_TAB_FEATURE_KEYS['programme-enrollment']);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/dashboard/ambassador');
                setData(response.data);
            } catch (err: any) {
                console.error('Error fetching ambassador data:', err);
                setError(err.response?.data?.message || 'Failed to load dashboard data');
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

    if (error || !data) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <h6 className="mb-0 fw-bold">Dashboard Error</h6>
                        <p className="mb-0 small">{error || 'Unable to load dashboard. Please contact the administrator.'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const { managedUnitName, stats, questionnaireProgress } = data;
    const qp = questionnaireProgress?.totals;
    const hasQuestionnaire = (qp?.assignments ?? 0) > 0;
    const reportingCard = reportingQuickCard(data);
    const showEnrollment =
        showEnrollmentReporting &&
        Boolean(data.canManageEnrollment) &&
        ((stats.enrollmentProgrammes ?? 0) > 0 || (stats.enrollmentCourseUnits ?? 0) > 0);

    return (
        <div id="page-dashboard" className="page-section active-page">
            {/* Performance indicators — primary reporting progress */}
            {hasQuestionnaire && qp ? (
                <>
                    <div className="kpi-hero mb-4" style={{ background: 'linear-gradient(135deg, #0f4c81 0%, #003366 100%)' }}>
                        <div className="row align-items-center g-3">
                            <div className="col-12 col-lg-7">
                                <div className="kpi-hero-badge">
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bar_chart</span>
                                    Performance indicators · {managedUnitName}
                                </div>
                                <div className="d-flex align-items-end gap-3 flex-wrap">
                                    <div>
                                        <div className="kpi-hero-value">
                                            {qp.fillRatePct}
                                            <span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span>
                                        </div>
                                        <div className="kpi-hero-label">Questionnaire data entry</div>
                                        <div className="progress mt-2" style={{ height: 8, background: 'rgba(255,255,255,0.15)', maxWidth: 280 }}>
                                            <div className="progress-bar" style={{ width: `${qp.fillRatePct}%`, background: 'linear-gradient(90deg, #60a5fa, #38bdf8)' }} />
                                        </div>
                                    </div>
                                    <div className="kpi-divider d-none d-sm-block" />
                                    <div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{qp.assignments}</div>
                                        <div className="kpi-hero-label">Assigned indicators</div>
                                    </div>
                                    <div className="kpi-divider d-none d-sm-block" />
                                    <div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#4ade80' }}>{qp.approvalRatePct}%</div>
                                        <div className="kpi-hero-label">HOD approved</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-lg-5">
                                <div className="row g-2 text-white text-center">
                                    <div className="col-4">
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#cbd5e1' }}>{qp.notStarted}</div>
                                        <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase' }}>Not started</div>
                                    </div>
                                    <div className="col-4">
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{qp.inProgress}</div>
                                        <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase' }}>In progress</div>
                                    </div>
                                    <div className="col-4">
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fca5a5' }}>{qp.needsRevision}</div>
                                        <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase' }}>Returned</div>
                                    </div>
                                </div>
                                <div className="text-end mt-3">
                                    <Link href="/ambassador?pg=reporting&tab=data-collection" className="btn btn-sm btn-light fw-bold">
                                        Open data collection →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="Not started" value={qp.notStarted} color="red" />
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="In progress" value={qp.inProgress} color="yellow" />
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="Ready to submit" value={qp.completeDraft} color="blue" />
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="Awaiting HOD" value={qp.awaitingReview} color="blue" />
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="Approved" value={qp.approved} color="green" />
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <StatCard label="Fill rate" value={`${qp.fillRatePct}%`} color="green" />
                        </div>
                    </div>

                    <div className="row g-4 mb-4">
                        <div className="col-12 col-lg-5">
                            <div className="bg-white p-4 rounded-3 border h-100">
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                                    Insights & next steps
                                </h6>
                                <div className="d-flex flex-column gap-2">
                                    {(questionnaireProgress?.insights ?? []).map((insight, i) => {
                                        const style = insightStyle(insight.type);
                                        const inner = (
                                            <div className="p-3 rounded-3 border-start border-3" style={{ background: style.bg, borderColor: style.border }}>
                                                <div className="d-flex gap-2">
                                                    <span className="material-symbols-outlined" style={{ color: style.color, fontSize: 20 }}>{insight.icon}</span>
                                                    <div>
                                                        <div className="fw-bold small">{insight.title}</div>
                                                        <div className="text-muted small">{insight.detail}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                        return insight.href ? (
                                            <Link key={i} href={insight.href} className="text-decoration-none">{inner}</Link>
                                        ) : (
                                            <div key={i}>{inner}</div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-lg-7">
                            <div className="bg-white p-4 rounded-3 border h-100">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <h6 className="fw-bold mb-0">Priority assignments</h6>
                                    <Link href="/ambassador?pg=reporting&tab=data-collection" className="small fw-bold text-decoration-none">View all →</Link>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-sm align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Indicator</th>
                                                <th>Progress</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(questionnaireProgress?.priorityAssignments ?? []).map((a) => (
                                                <tr key={a.indicatorId}>
                                                    <td>
                                                        <div className="small text-muted">{a.outcomeLabel}</div>
                                                        <div>{a.indicatorText}</div>
                                                    </td>
                                                    <td className="small">
                                                        {PROGRESS_LABELS[a.progressStatus]}
                                                        <div className="text-muted">{a.filled}/{a.total}</div>
                                                    </td>
                                                    <td>
                                                        <Badge bg={CATEGORY_BADGE[a.reportingCategory].bg} className="me-1">
                                                            {CATEGORY_BADGE[a.reportingCategory].label}
                                                        </Badge>
                                                        <div className="small text-muted mt-1">{HOD_REVIEW_STATUS_LABELS[a.hodReviewStatus]}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {(questionnaireProgress?.byOutcome ?? []).length > 0 ? (
                        <div className="bg-white p-4 rounded-3 border mb-4">
                            <h6 className="fw-bold mb-3">Progress by outcome</h6>
                            <div className="d-flex flex-column gap-3">
                                {questionnaireProgress!.byOutcome.slice(0, 6).map((o) => (
                                    <div key={o.outcomeKey}>
                                        <div className="d-flex justify-content-between small mb-1">
                                            <span className="fw-medium text-truncate me-2">{o.outcomeType}: {o.outcomeLabel}</span>
                                            <span className="text-muted flex-shrink-0">{o.fillRatePct}% · {o.approved}/{o.assignments} approved</span>
                                        </div>
                                        <div className="progress" style={{ height: 8 }}>
                                            <div className="progress-bar bg-primary" style={{ width: `${o.fillRatePct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}

            <div className="d-flex align-items-center gap-2 mb-3 mt-2">
                <h6 className="fw-bold text-dark mb-0">Strategic activity tracking</h6>
                <span className="text-muted small">Area activities & monthly compliance</span>
            </div>

            <div className="kpi-hero mb-4">
                <div className="row align-items-center g-3">
                    <div className="col-12 col-md-auto text-center text-md-start">
                        <div className="kpi-hero-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
                            Strategic Plan Ambassador · {managedUnitName}
                        </div>
                        <div className="d-flex align-items-end gap-3 flex-wrap justify-content-center justify-content-md-start">
                            <div>
                                <div className="kpi-hero-value">
                                    {stats.overallProgress}
                                    <span style={{ fontSize: '2rem', color: '#93c5fd' }}>%</span>
                                </div>
                                <div className="kpi-hero-label">Dept. / Unit Strategic Progress</div>
                                <div className="progress mt-2" style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4, maxWidth: 280, overflow: 'hidden' }}>
                                    <div className="progress-bar" style={{ width: `${stats.overallProgress}%`, background: 'linear-gradient(90deg, #60a5fa, var(--mubs-blue))' }} />
                                </div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block" />
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{stats.totalActivities}</div>
                                <div className="kpi-hero-label">Area Activities</div>
                            </div>
                            <div className="kpi-divider d-none d-sm-block" />
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>
                                    {stats.complianceRate}<span style={{ fontSize: '1.2rem' }}>%</span>
                                </div>
                                <div className="kpi-hero-label">Monthly Reporting</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md ms-md-auto">
                        <div className="row g-3 text-white">
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4ade80' }}>{stats.onTrack}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#86efac', textTransform: 'uppercase' }}>On Track</div>
                            </div>
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--mubs-yellow)' }}>{stats.inProgress}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#fde68a', textTransform: 'uppercase' }}>In Progress</div>
                            </div>
                            <div className="col-4 text-center">
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fca5a5' }}>{stats.delayed}</div>
                                <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase' }}>Delayed</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showResultsTracking && (stats.rfIndicators ?? 0) > 0 ? (
                <div className="row g-3 mb-4">
                    <div className="col-12">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                            <h6 className="fw-bold text-dark mb-0">Results Framework snapshot</h6>
                            <Link href="/ambassador?pg=tracking&tab=results" className="small fw-bold text-decoration-none">
                                View details →
                            </Link>
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
                        <StatCard icon="rocket_launch" label="Overachievement" value={stats.rfOverachievement ?? 0} badge="Above" badgeIcon="north" color="blue" />
                    </div>
                </div>
            ) : null}

            {showEnrollment ? (
                <div className="row g-3 mb-4">
                    <div className="col-12">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                            <h6 className="fw-bold text-dark mb-0">Enrollment indicators</h6>
                            <Link href="/ambassador?pg=reporting&tab=programme-enrollment" className="small fw-bold text-decoration-none">
                                Enter / view data →
                            </Link>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="school" label="Programmes" value={stats.enrollmentProgrammes ?? 0} badge={`${stats.enrollmentProgrammeStudents ?? 0} students`} badgeIcon="groups" color="blue" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="library_books" label="Course units" value={stats.enrollmentCourseUnits ?? 0} badge={`${stats.enrollmentCourseUnitStudents ?? 0} students`} badgeIcon="menu_book" color="green" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="groups" label="Programme students" value={stats.enrollmentProgrammeStudents ?? 0} badge="University-wide" badgeIcon="public" color="yellow" />
                    </div>
                    <div className="col-6 col-md-3">
                        <StatCard icon="menu_book" label="CU students" value={stats.enrollmentCourseUnitStudents ?? 0} badge="University-wide" badgeIcon="public" color="blue" />
                    </div>
                </div>
            ) : null}

            {/* Stat cards */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="apartment"
                        label="Departments Overseen"
                        value={stats.totalUnits}
                        badge="Units"
                        badgeIcon="business"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="schedule"
                        label="Requires Attention"
                        value={stats.requiresAttention ?? 0}
                        badge={stats.requiresAttention > 0 ? 'Review' : 'Clear'}
                        badgeIcon="fact_check"
                        color={stats.requiresAttention > 0 ? 'red' : 'green'}
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="fact_check"
                        label="Monthly Reporting"
                        value={`${stats.complianceRate}%`}
                        badge={`${stats.departmentsReportedThisMonth ?? 0}/${stats.totalUnits} depts`}
                        badgeIcon="monitoring"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="speed"
                        label="In Progress"
                        value={stats.inProgress}
                        badge="Active"
                        badgeIcon="pending"
                        color="yellow"
                    />
                </div>
            </div>

            {/* Quick actions — Tracking / Reporting / Propose changes */}
            <div className="row g-3">
                {showComplianceTracking ? (
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=tracking&tab=compliance" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '22px' }}>fact_check</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Activity progress</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Tracking · monitor submissions</div>
                            </div>
                        </div>
                    </Link>
                </div>
                ) : null}
                {showResultsTracking ? (
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=tracking&tab=results" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 86, 150, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '22px' }}>analytics</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Results Framework</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>
                                    Tracking · indicator performance
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>
                ) : null}
                {showReportingMenu ? (
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href={reportingCard.href} className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: reportingCard.iconBg }}>
                                <span className="material-symbols-outlined" style={{ color: reportingCard.iconColor, fontSize: '22px' }}>{reportingCard.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>{reportingCard.title}</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>{reportingCard.subtitle}</div>
                            </div>
                        </div>
                    </Link>
                </div>
                ) : null}
                {showProposeChanges ? (
                <div className="col-12 col-sm-6 col-xl-3">
                    <Link href="/ambassador?pg=propose-changes" className="text-decoration-none h-100">
                        <div
                            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
                            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
                            {...quickActionHover}
                        >
                            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124, 58, 237, 0.1)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '22px' }}>edit_note</span>
                            </div>
                            <div className="min-w-0">
                                <div className="fw-black text-dark" style={{ fontSize: '.95rem', lineHeight: 1.25 }}>Propose changes</div>
                                <div className="text-muted small" style={{ fontSize: '.78rem' }}>Request setup or structure updates</div>
                            </div>
                        </div>
                    </Link>
                </div>
                ) : null}
            </div>
        </div>
    );
}
