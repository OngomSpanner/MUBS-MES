"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import * as XLSX from 'xlsx';
import StaffProfileModal from '@/components/Staff/StaffProfileModal';
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
import { GENDER_OPTIONS, StaffProfileData } from '@/lib/staff-biodata';
import { STAFF_CATEGORIES } from '@/lib/staff-categories';

interface DepartmentSummary {
    department: string;
    total: number;
    completed: number;
    inProgress: number;
    delayed: number;
    progress: number;
    score: string;
}

interface StaffEvaluation {
    user_id: number;
    name: string;
    email: string;
    department: string;
    faculty_office?: string | null;
    gender?: string | null;
    staff_category?: string | null;
    designation_grade?: string | null;
    position?: string | null;
    disability_status?: string | null;
    disability_type?: string | null;
    workplace_accommodation?: string | null;
    special_support_needs?: string | null;
    leave_status?: string | null;
    employment_status?: string | null;
    contract_type?: string | null;
    nationality?: string | null;
    date_of_birth?: string | null;
    date_first_appointment?: string | null;
    date_current_appointment?: string | null;
    date_office_assignment?: string | null;
    retirement_date?: string | null;
    contract_start_date?: string | null;
    contract_end_date?: string | null;
    account_status?: string | null;
    active_tasks?: number;
    assigned: number;
    completed: number;
    rate: number;
    evaluation: string;
}

interface StaffReportSummary {
    total_synced: number;
    active_accounts: number;
    pwd_count: number;
    pwd_pct: number;
    filtered_count: number;
}

const getScore = (progress: number) =>
    progress >= 80 ? 'Exceptional Performance' : progress >= 65 ? 'Exceeds Expectations' : progress >= 50 ? 'Meets Expectations' : 'Below Expectations';

const getEvaluation = (rate: number) =>
    rate >= 80 ? 'Exceptional Performance' : rate >= 60 ? 'Exceeds Expectations' : rate >= 40 ? 'Meets Expectations' : 'Below Expectations';

export default function ReportsView() {
    const [departmentSummaries, setUnitSummaries] = useState<DepartmentSummary[]>([]);
    const [staffEvaluations, setStaffEvaluations] = useState<StaffEvaluation[]>([]);
    const [strategicOverview, setStrategicOverview] = useState<{
        byPillar: { pillar: string; label: string; avg_progress: number; count: number }[];
        status: { completed: number; in_progress: number; delayed: number; pending: number };
    } | null>(null);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);

    const [summaryUnitFilter, setSummaryUnitFilter] = useState('All Departments');
    const [selectedUnit, setSelectedUnit] = useState('All Departments');
    const [pwdFilter, setPwdFilter] = useState('all');
    const [genderFilter, setGenderFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [staffSummary, setStaffSummary] = useState<StaffReportSummary | null>(null);
    const [profileStaff, setProfileStaff] = useState<StaffProfileData | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeTab, setActiveTab] = useState<
        'summary' | 'staff' | 'establishment' | 'promotion' | 'retention' | 'recruitment' | 'turnover' | 'development' | 'payments' | 'benefits' | 'trends' | 'workforce-assessments' | 'employment-skill-status' | 'miscellaneous'
    >('summary');

    const [departmentsList, setDepartmentsList] = useState<string[]>([]);

    // Pagination — Activity Summary
    const [departmentPage, setUnitPage] = useState(1);
    const UNIT_PAGE_SIZE = 5;

    // Pagination — Staff Evaluations
    const [staffPage, setStaffPage] = useState(1);
    const STAFF_PAGE_SIZE = 10;

    useEffect(() => { setUnitPage(1); }, [summaryUnitFilter]);
    useEffect(() => { setStaffPage(1); }, [selectedUnit, pwdFilter, genderFilter, categoryFilter]);

    useEffect(() => {
        axios.get('/api/departments')
            .then(({ data }) => setDepartmentsList((Array.isArray(data) ? data : []).map((d: any) => d.name)))
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

    useEffect(() => {
        setLoadingStaff(true);
        const params = new URLSearchParams();
        params.append('type', 'staff-evaluation');
        if (selectedUnit !== 'All Departments') params.append('department', selectedUnit);
        if (pwdFilter !== 'all') params.append('pwd', pwdFilter);
        if (genderFilter !== 'All') params.append('gender', genderFilter);
        if (categoryFilter !== 'All') params.append('staff_category', categoryFilter);

        axios.get(`/api/reports?${params.toString()}`)
            .then(({ data }) => {
                const payload = data.data as { rows?: any[]; summary?: StaffReportSummary };
                const rows = Array.isArray(payload?.rows) ? payload.rows : (Array.isArray(data.data) ? data.data : []);
                const mapped: StaffEvaluation[] = rows.map((r: any) => ({
                    user_id: Number(r.user_id),
                    name: r.name,
                    email: r.email || '',
                    department: r.department ?? '—',
                    faculty_office: r.faculty_office ?? null,
                    gender: r.gender ?? null,
                    staff_category: r.staff_category ?? null,
                    designation_grade: r.designation_grade ?? null,
                    position: r.position ?? null,
                    disability_status: r.disability_status ?? null,
                    disability_type: r.disability_type ?? null,
                    workplace_accommodation: r.workplace_accommodation ?? null,
                    special_support_needs: r.special_support_needs ?? null,
                    leave_status: r.leave_status ?? null,
                    employment_status: r.employment_status ?? null,
                    contract_type: r.contract_type ?? null,
                    nationality: r.nationality ?? null,
                    date_of_birth: r.date_of_birth ?? null,
                    date_first_appointment: r.date_first_appointment ?? null,
                    date_current_appointment: r.date_current_appointment ?? null,
                    date_office_assignment: r.date_office_assignment ?? null,
                    retirement_date: r.retirement_date ?? null,
                    contract_start_date: r.contract_start_date ?? null,
                    contract_end_date: r.contract_end_date ?? null,
                    account_status: r.account_status ?? null,
                    active_tasks: Number(r.active_tasks ?? 0),
                    assigned: Number(r.assigned),
                    completed: Number(r.completed),
                    rate: Number(r.rate ?? 0),
                    evaluation: getEvaluation(Number(r.rate ?? 0)),
                }));
                setStaffEvaluations(mapped);
                setStaffSummary(payload?.summary ?? null);
            })
            .catch(err => console.error('staff-evaluation error', err))
            .finally(() => setLoadingStaff(false));
    }, [selectedUnit, pwdFilter, genderFilter, categoryFilter]);

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
        if (activeTab === 'trends') {
            fetchStrategicOverview();
        }
    }, [activeTab]);

    const staffToProfile = (s: StaffEvaluation): StaffProfileData => ({
        id: s.user_id,
        full_name: s.name,
        email: s.email,
        department: s.department,
        faculty_office: s.faculty_office,
        gender: s.gender,
        nationality: s.nationality,
        position: s.position,
        designation_grade: s.designation_grade,
        staff_category: s.staff_category,
        contract_type: s.contract_type,
        leave_status: s.leave_status,
        employment_status: s.employment_status,
        account_status: s.account_status,
        date_of_birth: s.date_of_birth,
        date_first_appointment: s.date_first_appointment,
        date_current_appointment: s.date_current_appointment,
        date_office_assignment: s.date_office_assignment,
        retirement_date: s.retirement_date,
        contract_start_date: s.contract_start_date,
        contract_end_date: s.contract_end_date,
        active_tasks: s.active_tasks,
        disability_status: s.disability_status,
        disability_type: s.disability_type,
        workplace_accommodation: s.workplace_accommodation,
        special_support_needs: s.special_support_needs,
    });

    const exportExcel = (dataset: 'departments' | 'staff', filename: string) => {
        const rows = dataset === 'departments'
            ? filteredUnitSummaries.map(u => ({
                Department: u.department, Total: u.total, Completed: u.completed,
                'In Progress': u.inProgress, Delayed: u.delayed,
                'Avg Progress (%)': u.progress, Score: u.score
            }))
            : filteredStaff.map(s => ({
                'Staff Name': s.name,
                Department: s.department,
                Gender: s.gender || '',
                Category: s.staff_category || '',
                'Designation / Grade': s.designation_grade || '',
                'Disability Status': s.disability_status || '',
                'Disability Type': s.disability_type || '',
                Assigned: s.assigned,
                Completed: s.completed,
                'Completion Rate (%)': s.rate,
                Evaluation: s.evaluation
            }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    };

    const exportPDF = async (dataset: 'departments' | 'staff', filename: string) => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text(filename, 14, 15);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

        if (dataset === 'departments') {
            autoTable(doc, {
                startY: 28,
                head: [['Department', 'Total', 'Completed', 'In Progress', 'Delayed', 'Avg Progress', 'Score']],
                body: filteredUnitSummaries.map(u => [u.department, u.total, u.completed, u.inProgress, u.delayed, `${u.progress}%`, u.score]),
                foot: [['TOTAL / AVG', totals.total, totals.completed, totals.inProgress, totals.delayed, `${avgProgress}%`, '']],
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 92, 164] },
                footStyles: { fillColor: [240, 245, 255], textColor: [30, 92, 164], fontStyle: 'bold' }
            });
        } else {
            autoTable(doc, {
                startY: 28,
                head: [['Staff Name', 'Department', 'Gender', 'PwD', 'Category', 'Assigned', 'Completed', 'Rate', 'Evaluation']],
                body: filteredStaff.map(s => [
                    s.name,
                    s.department,
                    s.gender || '—',
                    s.disability_status || '—',
                    s.staff_category || '—',
                    s.assigned,
                    s.completed,
                    `${s.rate}%`,
                    s.evaluation,
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 92, 164] }
            });
        }
        doc.save(`${filename}.pdf`);
    };

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

    const showPwdColumns = pwdFilter === 'yes' || pwdFilter === 'all';

    // Filtered + paginated staff evaluations
    const filteredStaff = selectedUnit === 'All Departments'
        ? staffEvaluations
        : staffEvaluations.filter(s => s.department === selectedUnit);
    const totalStaffPages = Math.max(1, Math.ceil(filteredStaff.length / STAFF_PAGE_SIZE));
    const paginatedStaff = filteredStaff.slice((staffPage - 1) * STAFF_PAGE_SIZE, staffPage * STAFF_PAGE_SIZE);

    // Unique departments for staff filter
    const uniqueStaffUnits = Array.from(new Set(staffEvaluations.map(s => s.department))).filter(Boolean);

    const reportCards: { title: string; description: string; icon: string; color: string; dataset: 'departments' | 'staff' }[] = [
        { title: 'Activity Progress Summary', description: 'Overview of all activities by status & department', icon: 'bar_chart', color: 'var(--mubs-blue)', dataset: 'departments' },
        { title: 'Department Performance Snapshots', description: 'Per-department activity completion rates', icon: 'corporate_fare', color: '#10b981', dataset: 'departments' },
        { title: 'Staff Evaluation Summaries', description: 'Individual & departmental evaluation scores', icon: 'person_search', color: '#b45309', dataset: 'staff' },
        { title: 'Delayed Activities Report', description: 'All overdue items with escalation log', icon: 'report', color: 'var(--mubs-red)', dataset: 'departments' }
    ];

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

    return (
        <Layout>
            {/* Nav Tabs */}
            <ul className="nav nav-tabs border-0 mb-4 gap-2">
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'summary' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('summary')}>
                        Overview
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'staff' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('staff')}>
                        Staff Appraisal &amp; Profiles
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'establishment' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('establishment')}>
                        Staff Establishment
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'promotion' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('promotion')}>
                        Staff Promotions
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'retention' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('retention')}>
                        Staff Retention
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'recruitment' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('recruitment')}>
                        Staff Recruitment
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'turnover' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('turnover')}>
                        Staff Turnover
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'development' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('development')}>
                        Staff Development
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'payments' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('payments')}>
                        Staff Payments
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'benefits' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('benefits')}>
                        Staff Benefits
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'trends' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('trends')}>
                        Performance Trends
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'workforce-assessments' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('workforce-assessments')}>
                        Workforce Assessments
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'employment-skill-status' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('employment-skill-status')} title="No of annual employment & skill status report produced">
                        Employment &amp; Skills
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'strategic-priority' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('strategic-priority')} title="% of staff in strategic priority areas">
                        Strategic Priority
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'job-description-workplans' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('job-description-workplans')} title="% of staff with updated job description and workplans">
                        Job Descriptions
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'staff-student-ratio' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('staff-student-ratio')} title="Teaching staff list for staff:student ratio">
                        Staff-Student Ratio
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'programme-enrollment' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('programme-enrollment')} title="Number of students in each programme">
                        Programme Enrollment
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'course-unit-enrollment' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('course-unit-enrollment')} title="Number of students enrolled per course unit">
                        Course Unit Enrollment
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'miscellaneous' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('miscellaneous')}>
                        Miscellaneous
                    </button>
                </li>
            </ul>

            {activeTab === 'trends' && (
                <div className="mb-4">
                    <StrategicTrendSection />
                </div>
            )}

            {/* Report Cards - Only show if not on trends tab */}
            {activeTab === 'summary' && (
                <div className="row g-4 mb-4">
                    {reportCards.map((card, index) => (
                        <div className="col-12 col-md-6 col-xl-3" key={index}>
                            <div className="stat-card" style={{ borderLeftColor: card.color, cursor: 'pointer' }}>
                                <div className="stat-label">Report Type</div>
                                <div className="fw-bold text-dark" style={{ fontSize: '1rem', marginTop: '4px' }}>{card.title}</div>
                                <div className="text-muted mt-1" style={{ fontSize: '.75rem' }}>{card.description}</div>
                                <div className="d-flex gap-2 mt-3">
                                    <button
                                        className="btn btn-xs py-1 px-2 btn-outline-primary fw-bold"
                                        style={{ fontSize: '.75rem' }}
                                        onClick={() => exportPDF(card.dataset, card.title)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>picture_as_pdf</span> PDF
                                    </button>
                                    <button
                                        className="btn btn-xs py-1 px-2 btn-outline-success fw-bold"
                                        style={{ fontSize: '.75rem' }}
                                        onClick={() => exportExcel(card.dataset, card.title)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>table_chart</span> Excel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'summary' && (
                /* Activity Progress Summary */
                <>
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
                                {departmentsList.map(name => <option key={name} value={name}>{name}</option>)}
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
                            <button className="btn btn-sm btn-success fw-bold" onClick={() => exportExcel('departments', 'Activity Progress Summary')}>
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                                Export Current View
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table mb-0">
                            <thead>
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
                </>
            )}

            {activeTab === 'establishment' && (
                <StaffEstablishmentPanel />
            )}

            {activeTab === 'promotion' && (
                <StaffPromotionPanel />
            )}

            {activeTab === 'retention' && (
                <StaffRetentionPanel />
            )}

            {activeTab === 'recruitment' && (
                <StaffRecruitmentPanel />
            )}

            {activeTab === 'turnover' && (
                <StaffTurnoverPanel />
            )}

            {activeTab === 'development' && (
                <StaffDevelopmentPanel />
            )}

            {activeTab === 'payments' && (
                <StaffPaymentsPanel />
            )}

            {activeTab === 'benefits' && (
                <StaffBenefitsPanel />
            )}

            {activeTab === 'workforce-assessments' && (
                <StaffWorkforceAssessmentsPanel />
            )}

            {activeTab === 'employment-skill-status' && (
                <StaffEmploymentSkillStatusPanel />
            )}

            {activeTab === 'strategic-priority' && (
                <StaffStrategicPriorityPanel />
            )}

            {activeTab === 'job-description-workplans' && (
                <StaffJobDescriptionWorkplansPanel />
            )}

            {activeTab === 'staff-student-ratio' && (
                <StaffStudentRatioPanel />
            )}

            {activeTab === 'programme-enrollment' && (
                <StaffProgrammeEnrollmentPanel />
            )}

            {activeTab === 'course-unit-enrollment' && (
                <StaffCourseUnitEnrollmentPanel />
            )}

            {activeTab === 'miscellaneous' && (
                <StaffMiscellaneousPanel />
            )}

            {activeTab === 'staff' && (
                <div className="table-card">
                    <div className="table-card-header">
                        <h5>
                            <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>person_search</span>
                            Staff Appraisal &amp; Profiles
                        </h5>
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '160px' }}
                                value={selectedUnit}
                                onChange={e => setSelectedUnit(e.target.value)}
                            >
                                <option>All Departments</option>
                                {departmentsList.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '130px' }}
                                value={pwdFilter}
                                onChange={e => setPwdFilter(e.target.value)}
                            >
                                <option value="all">All staff</option>
                                <option value="yes">PwD only</option>
                                <option value="no">Non-PwD</option>
                                <option value="not_recorded">Not recorded</option>
                            </select>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '120px' }}
                                value={genderFilter}
                                onChange={e => setGenderFilter(e.target.value)}
                            >
                                <option value="All">All genders</option>
                                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '140px' }}
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All categories</option>
                                {STAFF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                                className="btn btn-sm btn-outline-danger fw-bold"
                                onClick={() => exportPDF('staff', 'Staff Evaluations')}
                            >
                                PDF
                            </button>
                            <button
                                className="btn btn-sm btn-primary fw-bold"
                                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                onClick={() => exportExcel('staff', 'Staff Evaluations')}
                            >
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                                Export
                            </button>
                        </div>
                    </div>
                    {staffSummary && (
                        <div className="px-4 py-2 border-bottom bg-light small d-flex flex-wrap gap-3">
                            <span>
                                <strong>{staffSummary.pwd_count}</strong> PwD of{' '}
                                <strong>{staffSummary.total_synced.toLocaleString()}</strong> HR-synced staff (
                                {staffSummary.pwd_pct}%) ·{' '}
                                <strong>{staffSummary.active_accounts.toLocaleString()}</strong> active M&E accounts
                            </span>
                            <span className="text-muted">Showing {filteredStaff.length.toLocaleString()} in current filter</span>
                        </div>
                    )}
                    <div className="table-responsive">
                        <table className="table mb-0">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Department</th>
                                    {showPwdColumns && <th>Gender</th>}
                                    {showPwdColumns && <th>PwD</th>}
                                    {pwdFilter === 'yes' && <th>Disability Type</th>}
                                    {showPwdColumns && <th>Category</th>}
                                    <th>Activities Assigned</th>
                                    <th>Completed</th>
                                    <th>Completion Rate</th>
                                    <th>Evaluation</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingStaff ? (
                                    <tr><td colSpan={12} className="text-center py-4"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></td></tr>
                                ) : paginatedStaff.length === 0 ? (
                                    <tr><td colSpan={12} className="text-center py-4 text-muted">No staff found for the selected filters</td></tr>
                                ) : paginatedStaff.map((staff) => {
                                    const scoreStyle = getScoreBadge(staff.evaluation);
                                    return (
                                        <tr key={staff.user_id}>
                                            <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{staff.name}</td>
                                            <td style={{ fontSize: '.83rem' }}>{staff.department}</td>
                                            {showPwdColumns && <td style={{ fontSize: '.83rem' }}>{staff.gender || '—'}</td>}
                                            {showPwdColumns && (
                                                <td style={{ fontSize: '.83rem' }}>
                                                    {staff.disability_status === 'Yes' ? (
                                                        <span className="badge bg-info text-dark">Yes</span>
                                                    ) : (
                                                        staff.disability_status || '—'
                                                    )}
                                                </td>
                                            )}
                                            {pwdFilter === 'yes' && <td style={{ fontSize: '.83rem' }}>{staff.disability_type || '—'}</td>}
                                            {showPwdColumns && <td style={{ fontSize: '.83rem' }}>{staff.staff_category || '—'}</td>}
                                            <td style={{ fontSize: '.83rem' }}>{staff.assigned}</td>
                                            <td style={{ fontSize: '.83rem' }}>{staff.completed}</td>
                                            <td>
                                                <div className="progress-bar-custom" style={{ width: '80px', display: 'inline-block', verticalAlign: 'middle' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${staff.rate}%`, background: staff.rate >= 70 ? '#10b981' : staff.rate >= 50 ? '#ffcd00' : '#e31837' }} />
                                                </div>
                                                <span style={{ fontSize: '.75rem', marginLeft: '6px' }}>{staff.rate}%</span>
                                            </td>
                                            <td>
                                                <span className="status-badge" style={{ background: scoreStyle.bg, color: scoreStyle.color }}>{staff.evaluation}</span>
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 px-2 py-1"
                                                    style={{ fontSize: '.75rem', borderRadius: '8px' }}
                                                    onClick={() => setProfileStaff(staffToProfile(staff))}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_search</span>
                                                    Profile
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-card-footer">
                        <span className="footer-label">
                            Showing {filteredStaff.length === 0 ? 0 : (staffPage - 1) * STAFF_PAGE_SIZE + 1}–{Math.min(staffPage * STAFF_PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length} staff
                        </span>
                        <Paginator page={staffPage} total={totalStaffPages} onPrev={() => setStaffPage(p => p - 1)} onNext={() => setStaffPage(p => p + 1)} onPage={setStaffPage} />
                    </div>
                </div>
            )}

            <StaffProfileModal
                staff={profileStaff}
                onClose={() => setProfileStaff(null)}
                mode="admin"
                onEditUser={() => {
                    const id = profileStaff?.id;
                    setProfileStaff(null);
                    if (id) window.location.href = `/admin?pg=users&edit=${id}`;
                }}
            />
        </Layout>
    );
}
