"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import * as XLSX from 'xlsx';
import StaffEstablishmentPanel from '@/components/Reports/StaffEstablishmentPanel';
import StaffPromotionPanel from '@/components/Reports/StaffPromotionPanel';
import StaffRetentionPanel from '@/components/Reports/StaffRetentionPanel';
import StaffRecruitmentPanel from '@/components/Reports/StaffRecruitmentPanel';
import StaffTurnoverPanel from '@/components/Reports/StaffTurnoverPanel';
import StaffDevelopmentPanel from '@/components/Reports/StaffDevelopmentPanel';
import StaffPaymentsPanel from '@/components/Reports/StaffPaymentsPanel';
import StaffBenefitsPanel from '@/components/Reports/StaffBenefitsPanel';
import StaffMiscellaneousPanel from '@/components/Reports/StaffMiscellaneousPanel';
import StaffWorkforceAssessmentsPanel from '@/components/Reports/StaffWorkforceAssessmentsPanel';
import StaffEmploymentSkillStatusPanel from '@/components/Reports/StaffEmploymentSkillStatusPanel';
import StaffStrategicPriorityPanel from '@/components/Reports/StaffStrategicPriorityPanel';
import StaffJobDescriptionWorkplansPanel from '@/components/Reports/StaffJobDescriptionWorkplansPanel';
import StaffStudentRatioPanel from '@/components/Reports/StaffStudentRatioPanel';
import StaffProgrammeEnrollmentPanel from '@/components/Reports/StaffProgrammeEnrollmentPanel';
import StaffCourseUnitEnrollmentPanel from '@/components/Reports/StaffCourseUnitEnrollmentPanel';
import AdminResultsFrameworkPanel from '@/components/Admin/AdminResultsFrameworkPanel';
import ReportsSubTabs, { ReportsTabShell } from '@/components/Reports/ReportsSubTabs';
import AmbassadorCollectedDataPanel from '@/components/Reports/data-collection/AmbassadorCollectedDataPanel';

interface DepartmentSummary {
    department: string;
    total: number;
    completed: number;
    inProgress: number;
    delayed: number;
    progress: number;
    score: string;
}

const getScore = (progress: number) =>
    progress >= 80 ? 'Exceptional Performance' : progress >= 65 ? 'Exceeds Expectations' : progress >= 50 ? 'Meets Expectations' : 'Below Expectations';

type PrimaryTab = 'activity' | 'data-collection' | 'results-framework';
type ActivitySubTab = 'monitoring' | 'trends' | 'strategic-priority';
type DataSubTab = 'hr' | 'ambassador' | 'other';
type HrSubTab =
    | 'establishment'
    | 'promotion'
    | 'retention'
    | 'recruitment'
    | 'turnover'
    | 'development'
    | 'payments'
    | 'benefits'
    | 'workforce-assessments'
    | 'employment-skill-status'
    | 'job-description-workplans'
    | 'miscellaneous';
type OtherSubTab = 'staff-student-ratio' | 'programme-enrollment' | 'course-unit-enrollment';

export default function ReportsView() {
    const [departmentSummaries, setUnitSummaries] = useState<DepartmentSummary[]>([]);
    const [strategicOverview, setStrategicOverview] = useState<{
        byPillar: { pillar: string; label: string; avg_progress: number; count: number }[];
        status: { completed: number; in_progress: number; delayed: number; pending: number };
    } | null>(null);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);

    const [summaryUnitFilter, setSummaryUnitFilter] = useState('All Departments');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('activity');
    const [activitySub, setActivitySub] = useState<ActivitySubTab>('monitoring');
    const [dataSub, setDataSub] = useState<DataSubTab>('hr');
    const [hrSub, setHrSub] = useState<HrSubTab>('establishment');
    const [otherSub, setOtherSub] = useState<OtherSubTab>('staff-student-ratio');

    const [departmentsList, setDepartmentsList] = useState<string[]>([]);

    // Pagination — Activity Summary
    const [departmentPage, setUnitPage] = useState(1);
    const UNIT_PAGE_SIZE = 5;

    useEffect(() => { setUnitPage(1); }, [summaryUnitFilter]);

    useEffect(() => {
        axios.get('/api/departments')
            .then(({ data }) => {
                const names = (Array.isArray(data) ? data : [])
                    .map((d: { name?: string }) => String(d.name || '').trim())
                    .filter(Boolean);
                setDepartmentsList([...new Set(names)].sort((a, b) => a.localeCompare(b)));
            })
            .catch(() => setDepartmentsList([]));
    }, []);

    const fetchActivitySummary = async () => {
        setLoadingUnits(true);
        try {
            const params = new URLSearchParams();
            params.append('type', 'activity-summary');
            if (summaryUnitFilter !== 'All Departments') params.append('department', summaryUnitFilter);
            if (dateFrom) params.append('from', dateFrom);
            if (dateTo) params.append('to', dateTo);

            const { data } = await axios.get(`/api/reports?${params.toString()}`);
            const rows: DepartmentSummary[] = (data.data as any[]).map(r => ({
                department: r.department,
                total: Number(r.total_activities),
                completed: Number(r.completed),
                inProgress: Number(r.in_progress),
                delayed: Number(r.delayed_cnt),
                progress: Number(r.avg_progress),
                score: getScore(Number(r.avg_progress))
            }));
            setUnitSummaries(rows);
        } catch (err) {
            console.error('activity-summary error', err);
        } finally {
            setLoadingUnits(false);
        }
    };

    useEffect(() => {
        fetchActivitySummary();
    }, [summaryUnitFilter, dateFrom, dateTo]);

    const fetchStrategicOverview = async () => {
        setLoadingTrend(true);
        try {
            const { data } = await axios.get('/api/reports?type=strategic-plan-overview');
            setStrategicOverview(data.data || null);
        } catch (err) {
            console.error('strategic-plan-overview error', err);
            setStrategicOverview(null);
        } finally {
            setLoadingTrend(false);
        }
    };

    const getScoreBadge = (score: string): { bg: string; color: string } => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'Excellent': { bg: '#dcfce7', color: '#15803d' },
            'Good': { bg: '#fef9c3', color: '#a16207' },
            'Fair': { bg: '#fde8d8', color: '#c2410c' },
            'Poor': { bg: '#fee2e2', color: '#b91c1c' },
            'Exceptional Performance': { bg: '#dcfce7', color: '#15803d' },
            'Exceeds Expectations': { bg: '#fef9c3', color: '#a16207' },
            'Meets Expectations': { bg: '#fde8d8', color: '#c2410c' },
            'Below Expectations': { bg: '#fee2e2', color: '#b91c1c' }
        };
        return styles[score as keyof typeof styles] || { bg: '#f1f5f9', color: '#475569' };
    };

    useEffect(() => {
        if (primaryTab === 'activity' && activitySub === 'trends') {
            fetchStrategicOverview();
        }
    }, [primaryTab, activitySub]);

    // Filtered Department Summaries
    const filteredUnitSummaries = summaryUnitFilter === 'All Departments'
        ? departmentSummaries
        : departmentSummaries.filter(u => u.department === summaryUnitFilter);

    // Computed totals row
    const totals = filteredUnitSummaries.reduce(
        (acc, u) => ({
            total: acc.total + u.total,
            completed: acc.completed + u.completed,
            inProgress: acc.inProgress + u.inProgress,
            delayed: acc.delayed + u.delayed,
        }),
        { total: 0, completed: 0, inProgress: 0, delayed: 0 }
    );
    const avgProgress = filteredUnitSummaries.length
        ? Math.round(filteredUnitSummaries.reduce((s, u) => s + u.progress, 0) / filteredUnitSummaries.length)
        : 0;

    // Paginated department summaries
    const totalUnitPages = Math.max(1, Math.ceil(filteredUnitSummaries.length / UNIT_PAGE_SIZE));
    const paginatedUnits = filteredUnitSummaries.slice((departmentPage - 1) * UNIT_PAGE_SIZE, departmentPage * UNIT_PAGE_SIZE);

    const exportExcel = (filename: string) => {
        const rows = filteredUnitSummaries.map(u => ({
            Department: u.department, Total: u.total, Completed: u.completed,
            'In Progress': u.inProgress, Delayed: u.delayed,
            'Avg Progress (%)': u.progress, Score: u.score
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    };

    const getPageNumbers = (current: number, totalPages: number): (number | 'ellipsis')[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
        const sorted = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
        const items: (number | 'ellipsis')[] = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('ellipsis');
            items.push(sorted[i]);
        }
        return items;
    };

    const Paginator = ({ page, total, onPrev, onNext, onPage }: { page: number; total: number; onPrev: () => void; onNext: () => void; onPage: (p: number) => void }) => {
        if (total <= 1) return null;
        const pageItems = getPageNumbers(page, total);
        return (
            <div className="d-flex gap-1 align-items-center flex-wrap">
                <button type="button" className="page-btn" disabled={page === 1} onClick={onPrev} aria-label="Previous page">‹</button>
                {pageItems.map((item, idx) =>
                    item === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-muted" style={{ fontSize: '.8rem' }}>…</span>
                    ) : (
                        <button
                            key={item}
                            type="button"
                            className={`page-btn ${item === page ? 'active' : ''}`}
                            onClick={() => onPage(item)}
                            aria-label={`Page ${item}`}
                            aria-current={item === page ? 'page' : undefined}
                        >
                            {item}
                        </button>
                    )
                )}
                <button type="button" className="page-btn" disabled={page === total} onClick={onNext} aria-label="Next page">›</button>
            </div>
        );
    };

    // Performance Trends: status overview (donut-style counts) + progress by pillar (horizontal bars)
    const StatusDonut = ({ status }: { status: { completed: number; in_progress: number; delayed: number; pending: number } }) => {
        const total = status.completed + status.in_progress + status.delayed + status.pending;
        if (total === 0) {
            return (
                <div className="d-flex flex-column align-items-center justify-content-center p-4 text-muted">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>donut_large</span>
                    <span className="small">No activities yet</span>
                </div>
            );
        }
        const items = [
            { key: 'completed', label: 'Completed', value: status.completed, color: '#10b981' },
            { key: 'in_progress', label: 'In progress', value: status.in_progress, color: 'var(--mubs-blue)' },
            { key: 'delayed', label: 'Delayed', value: status.delayed, color: '#ef4444' },
            { key: 'pending', label: 'Not started', value: status.pending, color: '#94a3b8' },
        ].filter((i) => i.value > 0);
        const circumference = 2 * Math.PI * 42;
        let offset = 0;
        const segments = items.map((i) => {
            const pct = i.value / total;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -offset;
            offset += pct * circumference;
            return { ...i, strokeDasharray, strokeDashoffset };
        });
        return (
            <div className="d-flex flex-column align-items-center">
                <svg width={120} height={120} viewBox="0 0 120 120" className="mb-2">
                    <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" strokeWidth="16" />
                    {segments.map((seg) => (
                        <circle
                            key={seg.key}
                            cx="60"
                            cy="60"
                            r="42"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="16"
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            transform="rotate(-90 60 60)"
                        />
                    ))}
                    <text x="60" y="58" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 700, fill: '#1e293b' }}>{total}</text>
                    <text x="60" y="72" textAnchor="middle" style={{ fontSize: '10px', fill: '#64748b' }}>activities</text>
                </svg>
                <div className="d-flex flex-wrap gap-3 justify-content-center small">
                    {items.map((i) => (
                        <span key={i.key} className="d-flex align-items-center gap-1">
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: i.color }} />
                            {i.label}: <strong>{i.value}</strong>
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    const PillarBarChart = ({ byPillar }: { byPillar: { pillar: string; label: string; avg_progress: number; count: number }[] }) => {
        const maxVal = 100;
        const barHeight = 28;
        const gap = 12;
        const labelWidth = 180;
        const barMaxWidth = 320;
        const height = byPillar.length * (barHeight + gap) - gap;
        const colors = ['var(--mubs-blue)', '#0d9488', '#b45309', '#7c3aed'];
        return (
            <div className="bg-white p-4 rounded-3 border">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <span className="material-symbols-outlined text-primary">stacked_bar_chart</span>
                    Progress by strategic pillar
                </h6>
                <p className="small text-muted mb-4">Average progress of main activities per pillar (Strategic Plan 2025–2030)</p>
                <svg width={labelWidth + barMaxWidth + 60} height={height + 40} style={{ overflow: 'visible' }}>
                    {byPillar.map((row, i) => {
                        const y = 24 + i * (barHeight + gap);
                        const w = (row.avg_progress / maxVal) * barMaxWidth;
                        return (
                            <g key={row.pillar}>
                                <text x={0} y={y + barHeight / 2 + 4} textAnchor="start" style={{ fontSize: '12px', fill: '#334155', fontWeight: 500 }}>{row.label}</text>
                                <rect x={labelWidth} y={y} width={barMaxWidth} height={barHeight} rx={4} fill="#f1f5f9" />
                                <rect x={labelWidth} y={y} width={w} height={barHeight} rx={4} fill={colors[i % colors.length]} />
                                <text x={labelWidth + barMaxWidth + 8} y={y + barHeight / 2 + 4} textAnchor="start" style={{ fontSize: '12px', fontWeight: 600, fill: '#1e293b' }}>{row.avg_progress}%{row.count > 0 ? ` (${row.count})` : ''}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        );
    };

    const StrategicTrendSection = () => {
        if (loadingTrend) return <div className="text-center p-5"><div className="spinner-border text-primary" /></div>;
        if (!strategicOverview) return <div className="text-center p-5 text-muted">Could not load strategic plan overview</div>;
        const { byPillar, status } = strategicOverview;
        return (
            <>
                <div className="row g-4 mb-4">
                    <div className="col-12 col-md-4">
                        <div className="bg-white p-4 rounded-3 border h-100">
                            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-primary">donut_large</span>
                                Activity status
                            </h6>
                            <p className="small text-muted mb-3">Main activities by status</p>
                            <StatusDonut status={status} />
                        </div>
                    </div>
                    <div className="col-12 col-md-8">
                        <PillarBarChart byPillar={byPillar} />
                    </div>
                </div>
            </>
        );
    };

    const PRIMARY_TABS = [
        { key: 'activity' as const, label: 'Activity', icon: 'monitoring', hint: 'Progress & trends' },
        { key: 'data-collection' as const, label: 'Data Collection', icon: 'database', hint: 'HR, ambassador & other' },
        { key: 'results-framework' as const, label: 'Results Framework', icon: 'analytics', hint: 'Targets & actuals matrix' },
    ];

    const ACTIVITY_TABS = [
        { key: 'monitoring' as const, label: 'Activity Monitoring', icon: 'summarize' },
        { key: 'trends' as const, label: 'Performance Trends', icon: 'trending_up' },
        { key: 'strategic-priority' as const, label: 'Strategic Priority', icon: 'flag' },
    ];

    const DATA_TABS = [
        { key: 'hr' as const, label: 'HR Data', icon: 'groups' },
        { key: 'ambassador' as const, label: 'Ambassador', icon: 'assignment' },
        { key: 'other' as const, label: 'Other', icon: 'category' },
    ];

    const HR_TABS: { key: HrSubTab; label: string }[] = [
        { key: 'establishment', label: 'Staff Establishment' },
        { key: 'promotion', label: 'Staff Promotions' },
        { key: 'retention', label: 'Staff Retention' },
        { key: 'recruitment', label: 'Staff Recruitment' },
        { key: 'turnover', label: 'Staff Turnover' },
        { key: 'development', label: 'Staff Development' },
        { key: 'payments', label: 'Staff Payments' },
        { key: 'benefits', label: 'Staff Benefits' },
        { key: 'workforce-assessments', label: 'Workforce Assessments' },
        { key: 'employment-skill-status', label: 'Employment & Skills' },
        { key: 'job-description-workplans', label: 'Job Descriptions' },
        { key: 'miscellaneous', label: 'Miscellaneous' },
    ];

    const OTHER_TABS = [
        { key: 'staff-student-ratio' as const, label: 'Staff–Student Ratio', icon: 'school' },
        { key: 'programme-enrollment' as const, label: 'Programme Enrollment', icon: 'menu_book' },
        { key: 'course-unit-enrollment' as const, label: 'Course Unit Enrollment', icon: 'library_books' },
    ];

    const renderHrPanel = () => {
        switch (hrSub) {
            case 'establishment': return <StaffEstablishmentPanel />;
            case 'promotion': return <StaffPromotionPanel />;
            case 'retention': return <StaffRetentionPanel />;
            case 'recruitment': return <StaffRecruitmentPanel />;
            case 'turnover': return <StaffTurnoverPanel />;
            case 'development': return <StaffDevelopmentPanel />;
            case 'payments': return <StaffPaymentsPanel />;
            case 'benefits': return <StaffBenefitsPanel />;
            case 'workforce-assessments': return <StaffWorkforceAssessmentsPanel />;
            case 'employment-skill-status': return <StaffEmploymentSkillStatusPanel />;
            case 'job-description-workplans': return <StaffJobDescriptionWorkplansPanel />;
            case 'miscellaneous': return <StaffMiscellaneousPanel />;
            default: return null;
        }
    };

    const renderOtherPanel = () => {
        switch (otherSub) {
            case 'staff-student-ratio': return <StaffStudentRatioPanel />;
            case 'programme-enrollment': return <StaffProgrammeEnrollmentPanel />;
            case 'course-unit-enrollment': return <StaffCourseUnitEnrollmentPanel />;
            default: return null;
        }
    };

    return (
        <Layout>
            <div className="page-section active-page">
                <div className="mb-4">
                    <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-primary">assessment</span>
                        Reports &amp; Analytics
                    </h5>
                    <p className="text-muted small mb-0">
                        Monitor activity progress, review collected HR and ambassador data, and track results framework performance.
                    </p>
                </div>

                <ReportsTabShell
                    primary={
                        <ReportsSubTabs
                            variant="primary"
                            tabs={PRIMARY_TABS}
                            active={primaryTab}
                            onChange={setPrimaryTab}
                        />
                    }
                    sub={
                        primaryTab === 'activity' ? (
                            <ReportsSubTabs
                                variant="secondary"
                                tabs={ACTIVITY_TABS}
                                active={activitySub}
                                onChange={setActivitySub}
                            />
                        ) : primaryTab === 'data-collection' ? (
                            <ReportsSubTabs
                                variant="secondary"
                                tabs={DATA_TABS}
                                active={dataSub}
                                onChange={setDataSub}
                            />
                        ) : null
                    }
                    tertiary={
                        primaryTab === 'data-collection' && dataSub === 'hr' ? (
                            <ReportsSubTabs
                                variant="tertiary"
                                tabs={HR_TABS}
                                active={hrSub}
                                onChange={setHrSub}
                            />
                        ) : primaryTab === 'data-collection' && dataSub === 'other' ? (
                            <ReportsSubTabs
                                variant="tertiary"
                                tabs={OTHER_TABS}
                                active={otherSub}
                                onChange={setOtherSub}
                            />
                        ) : null
                    }
                />

                {/* Activity → Monitoring */}
                {primaryTab === 'activity' && activitySub === 'monitoring' && (
                    <div className="table-card mb-4">
                        <div className="table-card-header">
                        <h5>
                            <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>summarize</span>
                            Activity Progress Summary
                        </h5>
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                style={{ width: '160px' }}
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                aria-label="From date"
                                title="From date"
                            />
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                style={{ width: '160px' }}
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                aria-label="To date"
                                title="To date"
                            />
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '220px' }}
                                value={summaryUnitFilter}
                                onChange={e => setSummaryUnitFilter(e.target.value)}
                                aria-label="Impact department"
                                title="Impact department"
                            >
                                <option>All Departments</option>
                                {departmentsList.map((name, i) => <option key={`${i}-${name}`} value={name}>{name}</option>)}
                            </select>
                            <button
                                className="btn btn-sm btn-primary fw-bold"
                                style={{ background: 'var(--mubs-blue)' }}
                                onClick={fetchActivitySummary}
                            >
                                Apply
                            </button>
                            <button
                                className="btn btn-sm btn-light border fw-bold"
                                onClick={() => { setDateFrom(''); setDateTo(''); setSummaryUnitFilter('All Departments'); }}
                            >
                                Reset
                            </button>
                            <button className="btn btn-sm btn-success fw-bold" onClick={() => exportExcel('Activity Progress Summary')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                                Export Current View
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.78rem' }}>
                            <thead className="table-dark">
                                <tr>
                                    <th>Department</th>
                                    <th>Total Activities</th>
                                    <th>Completed</th>
                                    <th>In Progress</th>
                                    <th>Delayed</th>
                                    <th>Avg. Progress</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingUnits ? (
                                    <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></td></tr>
                                ) : paginatedUnits.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-4 text-muted">No data found</td></tr>
                                ) : paginatedUnits.map((department, index) => {
                                    const scoreStyle = getScoreBadge(department.score);
                                    return (
                                        <tr key={index}>
                                            <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{department.department}</td>
                                            <td style={{ fontSize: '.83rem' }}>{department.total}</td>
                                            <td><span className="badge bg-success">{department.completed}</span></td>
                                            <td><span className="badge bg-warning text-dark">{department.inProgress}</span></td>
                                            <td><span className={`badge ${department.delayed === 0 ? 'bg-success' : 'bg-danger'}`}>{department.delayed}</span></td>
                                            <td>
                                                <div className="progress-bar-custom" style={{ width: '100px', display: 'inline-block', verticalAlign: 'middle' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${department.progress}%`, background: department.progress >= 70 ? '#10b981' : department.progress >= 50 ? '#ffcd00' : '#e31837' }} />
                                                </div>
                                                <span style={{ fontSize: '.75rem', marginLeft: '6px' }}>{department.progress}%</span>
                                            </td>
                                            <td>
                                                <span className="status-badge" style={{ background: scoreStyle.bg, color: scoreStyle.color }}>{department.score}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Totals row — computed from filtered dataset */}
                                {!loadingUnits && filteredUnitSummaries.length > 0 && (
                                    <tr style={{ background: '#f8fafc' }}>
                                        <td className="fw-bold" style={{ color: 'var(--mubs-blue)' }}>TOTAL / AVG</td>
                                        <td className="fw-bold text-dark">{totals.total}</td>
                                        <td><span className="fw-bold text-success">{totals.completed}</span></td>
                                        <td><span className="fw-bold" style={{ color: '#b45309' }}>{totals.inProgress}</span></td>
                                        <td><span className="fw-bold text-danger">{totals.delayed}</span></td>
                                        <td>
                                            <div className="progress-bar-custom" style={{ width: '100px', display: 'inline-block', verticalAlign: 'middle' }}>
                                                <div className="progress-bar-fill" style={{ width: `${avgProgress}%`, background: 'var(--mubs-blue)' }} />
                                            </div>
                                            <span style={{ fontSize: '.75rem', marginLeft: '6px', fontWeight: 700 }}>{avgProgress}%</span>
                                        </td>
                                        <td><span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Overall</span></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-card-footer">
                        <span className="footer-label">
                            Showing {filteredUnitSummaries.length === 0 ? 0 : (departmentPage - 1) * UNIT_PAGE_SIZE + 1}–{Math.min(departmentPage * UNIT_PAGE_SIZE, filteredUnitSummaries.length)} of {filteredUnitSummaries.length} departments
                        </span>
                        <Paginator page={departmentPage} total={totalUnitPages} onPrev={() => setUnitPage(p => p - 1)} onNext={() => setUnitPage(p => p + 1)} onPage={setUnitPage} />
                    </div>
                    </div>
                )}

                {primaryTab === 'activity' && activitySub === 'trends' && (
                    <div className="mb-4">
                        <StrategicTrendSection />
                    </div>
                )}

                {primaryTab === 'activity' && activitySub === 'strategic-priority' && (
                    <div className="mb-4">
                        <StaffStrategicPriorityPanel />
                    </div>
                )}

                {primaryTab === 'data-collection' && dataSub === 'hr' && (
                    <div className="mb-4">
                        {renderHrPanel()}
                    </div>
                )}

                {primaryTab === 'data-collection' && dataSub === 'ambassador' && (
                    <div className="table-card p-3 p-md-4 mb-4">
                        <AmbassadorCollectedDataPanel />
                    </div>
                )}

                {primaryTab === 'data-collection' && dataSub === 'other' && (
                    <div className="mb-4">
                        {renderOtherPanel()}
                    </div>
                )}

                {primaryTab === 'results-framework' && (
                    <AdminResultsFrameworkPanel />
                )}
            </div>
        </Layout>
    );
}
