"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import * as XLSX from 'xlsx';

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
    name: string;
    department: string;
    assigned: number;
    completed: number;
    rate: number;
    evaluation: string;
}

const getScore = (progress: number) =>
    progress >= 80 ? 'Excellent' : progress >= 65 ? 'Good' : progress >= 50 ? 'Fair' : 'Poor';

const getEvaluation = (rate: number) =>
    rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : rate >= 40 ? 'Fair' : 'Poor';

export default function ReportsView() {
    const [departmentSummaries, setUnitSummaries] = useState<DepartmentSummary[]>([]);
    const [staffEvaluations, setStaffEvaluations] = useState<StaffEvaluation[]>([]);
    const [trendData, setTrendData] = useState<{ label: string; avg_progress: number }[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);

    const [summaryUnitFilter, setSummaryUnitFilter] = useState('All Departments');
    const [selectedUnit, setSelectedUnit] = useState('All Departments');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeTab, setActiveTab] = useState<'summary' | 'staff' | 'trends'>('summary');

    // Pagination — Activity Summary
    const [departmentPage, setUnitPage] = useState(1);
    const UNIT_PAGE_SIZE = 5;

    // Pagination — Staff Evaluations
    const [staffPage, setStaffPage] = useState(1);
    const STAFF_PAGE_SIZE = 5;

    useEffect(() => { setUnitPage(1); }, [summaryUnitFilter]);
    useEffect(() => { setStaffPage(1); }, [selectedUnit]);

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

        axios.get(`/api/reports?${params.toString()}`)
            .then(({ data }) => {
                const rows: StaffEvaluation[] = (data.data as any[]).map(r => ({
                    name: r.name,
                    department: r.department ?? '—',
                    assigned: Number(r.assigned),
                    completed: Number(r.completed),
                    rate: Number(r.rate ?? 0),
                    evaluation: getEvaluation(Number(r.rate ?? 0))
                }));
                setStaffEvaluations(rows);
            })
            .catch(err => console.error('staff-evaluation error', err))
            .finally(() => setLoadingStaff(false));
    }, [selectedUnit]);

    useEffect(() => {
        axios.get('/api/reports?type=trend-analysis')
            .then(({ data }) => {
                setTrendData(data.data || []);
            })
            .catch(err => console.error('trend-analysis error', err))
            .finally(() => setLoadingTrend(false));
    }, []);

    const getScoreBadge = (score: string) => {
        const styles: { [key: string]: { bg: string; color: string } } = {
            'Excellent': { bg: '#dcfce7', color: '#15803d' },
            'Good': { bg: '#fef9c3', color: '#a16207' },
            'Fair': { bg: '#fde8d8', color: '#c2410c' },
            'Poor': { bg: '#fee2e2', color: '#b91c1c' }
        };
        return styles[score] || { bg: '#f1f5f9', color: '#475569' };
    };

    // ── Export helpers ─────────────────────────────────────────────
    const exportExcel = (dataset: 'departments' | 'staff', filename: string) => {
        const rows = dataset === 'departments'
            ? filteredUnitSummaries.map(u => ({
                Department: u.department, Total: u.total, Completed: u.completed,
                'In Progress': u.inProgress, Delayed: u.delayed,
                'Avg Progress (%)': u.progress, Score: u.score
            }))
            : filteredStaff.map(s => ({
                'Staff Name': s.name, Department: s.department, Assigned: s.assigned,
                Completed: s.completed, 'Completion Rate (%)': s.rate, Evaluation: s.evaluation
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
                head: [['Staff Name', 'Department', 'Assigned', 'Completed', 'Rate', 'Evaluation']],
                body: filteredStaff.map(s => [s.name, s.department, s.assigned, s.completed, `${s.rate}%`, s.evaluation]),
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

    const Paginator = ({ page, total, onPrev, onNext, onPage }: { page: number; total: number; onPrev: () => void; onNext: () => void; onPage: (p: number) => void }) => (
        <div className="d-flex gap-1">
            <button className="page-btn" disabled={page === 1} onClick={onPrev}>‹</button>
            {Array.from({ length: total }, (_, i) => i + 1).map(pg => (
                <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => onPage(pg)}>{pg}</button>
            ))}
            <button className="page-btn" disabled={page === total} onClick={onNext}>›</button>
        </div>
    );

    const TrendChart = () => {
        if (loadingTrend) return <div className="text-center p-5"><div className="spinner-border text-primary" /></div>;
        if (!trendData.length) return <div className="text-center p-5 text-muted">No trend data available</div>;

        const height = 200;
        const width = 800;
        const padding = 40;
        const maxVal = 100;

        const points = trendData.map((d, i) => {
            const x = padding + (i * (width - 2 * padding) / (trendData.length - 1));
            const y = height - padding - (d.avg_progress * (height - 2 * padding) / maxVal);
            return { x, y, ...d };
        });

        const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

        return (
            <div className="bg-white p-4 rounded-3 border" style={{ overflowX: 'auto' }}>
                <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
                    <span className="material-symbols-outlined text-primary">trending_up</span>
                    Institution-wide Progress Trend (Last 90 Days)
                </h6>
                <svg width={width} height={height} style={{ overflow: 'visible' }}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(h => {
                        const y = height - padding - (h * (height - 2 * padding) / maxVal);
                        return (
                            <g key={h}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
                                <text x={padding - 10} y={y + 4} textAnchor="end" style={{ fontSize: '10px', fill: '#64748b' }}>{h}%</text>
                            </g>
                        );
                    })}
                    {/* Data line */}
                    <path d={pathD} fill="none" stroke="var(--mubs-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Dots */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="5" fill="var(--mubs-blue)" />
                            <text x={p.x} y={height - 10} textAnchor="middle" style={{ fontSize: '10px', fill: '#64748b' }}>{p.label}</text>
                            <text x={p.x} y={p.y - 10} textAnchor="middle" className="fw-bold" style={{ fontSize: '10px', fill: 'var(--mubs-blue)' }}>{p.avg_progress}%</text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    return (
        <Layout>
            {/* Custom Report Builder Panel */}
            <div className="table-card mb-4 p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold m-0 d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>tune</span>
                        Custom Report Filters
                    </h6>
                    <button className="btn btn-sm btn-light border" onClick={() => { setDateFrom(''); setDateTo(''); setSummaryUnitFilter('All Departments'); }}>
                        Reset Filters
                    </button>
                </div>
                <div className="row g-3">
                    <div className="col-md-3">
                        <label className="fw-bold small mb-1">From Date</label>
                        <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                        <label className="fw-bold small mb-1">To Date</label>
                        <input type="date" className="form-control form-control-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                        <label className="fw-bold small mb-1">Impact Department</label>
                        <select className="form-select form-select-sm" value={summaryUnitFilter} onChange={e => setSummaryUnitFilter(e.target.value)}>
                            <option>All Departments</option>
                            {departmentSummaries.map(u => <option key={u.department}>{u.department}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                        <button className="btn btn-sm btn-primary w-100 fw-bold" style={{ background: 'var(--mubs-blue)' }} onClick={fetchActivitySummary}>
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Nav Tabs */}
            <ul className="nav nav-tabs border-0 mb-4 gap-2">
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'summary' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('summary')}>
                        Overview
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'staff' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('staff')}>
                        Staff Appraisal
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'trends' ? 'active bg-primary text-white border-primary' : 'text-muted'}`} onClick={() => setActiveTab('trends')}>
                        Performance Trends
                    </button>
                </li>
            </ul>

            {activeTab === 'trends' && <div className="mb-4"><TrendChart /></div>}

            {/* Report Cards - Only show if not on trends tab */}
            {activeTab === 'summary' && (
                <div className="row g-4 mb-4">
                    {reportCards.map((card, index) => (
                        <div className="col-12 col-md-6 col-xl-3" key={index}>
                            <div className="stat-card" style={{ borderLeftColor: card.color, cursor: 'pointer' }}>
                                <div className="stat-icon mb-3" style={{ background: '#eff6ff' }}>
                                    <span className="material-symbols-outlined" style={{ color: card.color }}>{card.icon}</span>
                                </div>
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
                <div className="table-card mb-4">
                    <div className="table-card-header">
                        <h5>
                            <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>summarize</span>
                            Activity Progress Summary
                        </h5>
                        <div className="d-flex gap-2">
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
            )}

            {activeTab === 'staff' && (
                /* Staff Evaluations */
                <div className="table-card">
                    <div className="table-card-header">
                        <h5>
                            <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>person_search</span>
                            Staff Evaluation Snapshots
                        </h5>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-sm btn-primary fw-bold"
                                style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                onClick={() => exportExcel('staff', 'Staff Evaluations')}
                            >
                                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                                Export Current View
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table mb-0">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Department</th>
                                    <th>Activities Assigned</th>
                                    <th>Completed</th>
                                    <th>Completion Rate</th>
                                    <th>Evaluation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingStaff ? (
                                    <tr><td colSpan={6} className="text-center py-4"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></td></tr>
                                ) : paginatedStaff.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-4 text-muted">No evaluations found</td></tr>
                                ) : paginatedStaff.map((staff, index) => {
                                    const scoreStyle = getScoreBadge(staff.evaluation);
                                    return (
                                        <tr key={index}>
                                            <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{staff.name}</td>
                                            <td style={{ fontSize: '.83rem' }}>{staff.department}</td>
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
        </Layout>
    );
}
