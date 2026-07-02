'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import ReportsSectionHeader from '@/components/Reports/ReportsSectionHeader';
import AmbassadorCollectedDataPanel from '@/components/Reports/data-collection/AmbassadorCollectedDataPanel';
import { Badge, Button, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { HOD_REVIEW_STATUS_LABELS } from '@/lib/hod-review-workflow-constants';
import type {
  AmbassadorReportsSummary,
  AssignmentRow,
  DepartmentRollup,
} from '@/lib/admin/ambassador-reports-aggregate';
import type { ReminderAudience } from '@/lib/ambassador-report-reminders';

type SectionTab = 'overview' | 'departments' | 'objectives' | 'outcomes' | 'hod' | 'aging' | 'assignments' | 'collected-data';

const SECTION_TABS: { key: SectionTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'departments', label: 'By department', icon: 'apartment' },
  { key: 'objectives', label: 'By objective', icon: 'flag' },
  { key: 'outcomes', label: 'By outcome', icon: 'account_tree' },
  { key: 'hod', label: 'HOD approvals', icon: 'fact_check' },
  { key: 'aging', label: 'HOD aging', icon: 'schedule' },
  { key: 'assignments', label: 'Assignment detail', icon: 'list_alt' },
  { key: 'collected-data', label: 'Collected values', icon: 'table_chart' },
];

const VALID_SECTIONS = new Set<SectionTab>(SECTION_TABS.map((t) => t.key));

const PROGRESS_LABELS: Record<AssignmentRow['progressStatus'], string> = {
  'not-started': 'Not started',
  partial: 'In progress',
  complete: 'Complete',
};

const CATEGORY_BADGE: Record<AssignmentRow['reportingCategory'], { bg: string; label: string }> = {
  'not-completed': { bg: 'secondary', label: 'Not completed' },
  'awaiting-review': { bg: 'warning', label: 'Awaiting HOD' },
  completed: { bg: 'success', label: 'Approved' },
  'needs-revision': { bg: 'danger', label: 'Returned' },
};

function ProgressDonut({ totals }: { totals: AmbassadorReportsSummary['totals'] }) {
  const items = [
    { key: 'notStarted', label: 'Not started', value: totals.notStarted, color: '#94a3b8' },
    { key: 'inProgress', label: 'In progress', value: totals.inProgress, color: '#f59e0b' },
    { key: 'completeDraft', label: 'Complete (draft)', value: totals.completeDraft, color: '#0ea5e9' },
    { key: 'awaitingReview', label: 'Awaiting HOD', value: totals.awaitingReview, color: '#6366f1' },
    { key: 'approved', label: 'Approved', value: totals.approved, color: '#10b981' },
    { key: 'needsRevision', label: 'Returned', value: totals.needsRevision, color: '#ef4444' },
  ].filter((i) => i.value > 0);

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-4 text-muted">
        <span className="material-symbols-outlined mb-2" style={{ fontSize: 48 }}>donut_large</span>
        <span className="small">No indicator assignments yet</span>
      </div>
    );
  }

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
        <text x="60" y="58" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: '#1e293b' }}>{total}</text>
        <text x="60" y="72" textAnchor="middle" style={{ fontSize: 10, fill: '#64748b' }}>assignments</text>
      </svg>
      <div className="d-flex flex-wrap gap-2 justify-content-center small">
        {items.map((i) => (
          <span key={i.key} className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: i.color }} />
            {i.label}: <strong>{i.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function DepartmentBarChart({ rows }: { rows: DepartmentRollup[] }) {
  const data = rows.slice(0, 12);
  const barHeight = 22;
  const gap = 8;
  const labelWidth = 160;
  const barMaxWidth = 280;
  const height = data.length * (barHeight + gap) - gap;

  return (
    <svg width={labelWidth + barMaxWidth + 56} height={height + 24} style={{ overflow: 'visible', maxWidth: '100%' }}>
      {data.map((row, i) => {
        const y = 12 + i * (barHeight + gap);
        const w = (row.fillRatePct / 100) * barMaxWidth;
        return (
          <g key={row.departmentId}>
            <text x={0} y={y + barHeight / 2 + 4} textAnchor="start" style={{ fontSize: 11, fill: '#334155' }}>
              {row.departmentName.length > 22 ? `${row.departmentName.slice(0, 20)}…` : row.departmentName}
            </text>
            <rect x={labelWidth} y={y} width={barMaxWidth} height={barHeight} rx={4} fill="#f1f5f9" />
            <rect x={labelWidth} y={y} width={w} height={barHeight} rx={4} fill="var(--mubs-blue)" />
            <text x={labelWidth + barMaxWidth + 6} y={y + barHeight / 2 + 4} style={{ fontSize: 11, fontWeight: 600 }}>
              {row.fillRatePct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function exportSheet(filename: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

export default function AmbassadorReportsView() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<AmbassadorReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionTab>('overview');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AssignmentRow['reportingCategory']>('all');
  const [progressFilter, setProgressFilter] = useState<'all' | AssignmentRow['progressStatus']>('all');
  const [remindAudience, setRemindAudience] = useState<ReminderAudience | null>(null);
  const [reminding, setReminding] = useState(false);
  const [remindResult, setRemindResult] = useState<string | null>(null);

  useEffect(() => {
    const urlSection = searchParams.get('section') as SectionTab | null;
    if (urlSection && VALID_SECTIONS.has(urlSection)) {
      setSection(urlSection);
    }
    const urlCategory = searchParams.get('category');
    if (urlCategory === 'not-completed' || urlCategory === 'awaiting-review' || urlCategory === 'completed' || urlCategory === 'needs-revision') {
      setCategoryFilter(urlCategory);
      if (!urlSection || urlSection === 'overview') setSection('assignments');
    }
    const urlFilter = searchParams.get('filter');
    if (urlFilter === 'not_started') {
      setProgressFilter('not-started');
      setSection('assignments');
    } else if (urlFilter === 'in_progress') {
      setProgressFilter('partial');
      setSection('assignments');
    } else if (urlFilter === 'awaiting_hod') {
      setCategoryFilter('awaiting-review');
      setSection('aging');
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<AmbassadorReportsSummary>('/api/admin/ambassador-reports/summary');
      setSummary(res.data);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setError(String(msg || 'Failed to load ambassador reports'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAssignments = useMemo(() => {
    if (!summary) return [];
    const q = search.trim().toLowerCase();
    return summary.assignments.filter((a) => {
      if (categoryFilter !== 'all' && a.reportingCategory !== categoryFilter) return false;
      if (progressFilter !== 'all' && a.progressStatus !== progressFilter) return false;
      if (!q) return true;
      return (
        a.departmentName.toLowerCase().includes(q)
        || a.indicatorText.toLowerCase().includes(q)
        || (a.ambassadorName || '').toLowerCase().includes(q)
        || (a.outcomeLabel || '').toLowerCase().includes(q)
      );
    });
  }, [summary, search, categoryFilter, progressFilter]);

  const sendReminder = async () => {
    if (!remindAudience) return;
    setReminding(true);
    setRemindResult(null);
    try {
      const res = await axios.post('/api/admin/ambassador-reports/remind', { audience: remindAudience });
      const r = res.data as { recipientsNotified: number; emailsSent: number; inAppCreated: number; skippedNoContact: number };
      setRemindResult(
        `Notified ${r.recipientsNotified} recipient(s) (${r.emailsSent} email, ${r.inAppCreated} in-app).`
        + (r.skippedNoContact ? ` ${r.skippedNoContact} skipped (no contact).` : ''),
      );
      setRemindAudience(null);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : null;
      setRemindResult(String(msg || 'Failed to send reminders'));
    } finally {
      setReminding(false);
    }
  };

  const exportDepartments = () => {
    if (!summary) return;
    exportSheet(
      'ambassador-progress-by-department.xlsx',
      summary.byDepartment.map((d) => ({
        Department: d.departmentName,
        Ambassador: d.ambassadorName || '',
        Email: d.ambassadorEmail || '',
        Assignments: d.assignments,
        'Not started': d.notStarted,
        'In progress': d.inProgress,
        'Complete (draft)': d.completeDraft,
        'Awaiting HOD': d.awaitingReview,
        Approved: d.approved,
        Returned: d.needsRevision,
        'Fill rate %': d.fillRatePct,
        'Approval rate %': d.approvalRatePct,
      })),
    );
  };

  const exportObjectives = () => {
    if (!summary) return;
    exportSheet(
      'ambassador-progress-by-objective.xlsx',
      summary.byObjective.map((o) => ({
        Objective: o.objectiveShort,
        Assignments: o.assignments,
        'Not started': o.notStarted,
        'In progress': o.inProgress,
        'Awaiting HOD': o.awaitingReview,
        Approved: o.approved,
        Returned: o.needsRevision,
        'Fill rate %': o.fillRatePct,
        'Approval rate %': o.approvalRatePct,
      })),
    );
  };

  const exportAssignments = () => {
    exportSheet(
      'ambassador-assignments-detail.xlsx',
      filteredAssignments.map((a) => ({
        Department: a.departmentName,
        Ambassador: a.ambassadorName || '',
        Outcome: a.outcomeLabel,
        Objective: a.strategicObjective || '',
        Indicator: a.indicatorText,
        Progress: PROGRESS_LABELS[a.progressStatus],
        Filled: a.filled,
        Total: a.total,
        'HOD status': HOD_REVIEW_STATUS_LABELS[a.hodReviewStatus],
        Category: CATEGORY_BADGE[a.reportingCategory].label,
        'Submitted at': a.submittedAt || '',
        'HOD reviewed at': a.hodReviewedAt || '',
      })),
    );
  };

  const exportHod = () => {
    if (!summary) return;
    exportSheet(
      'hod-approval-progress.xlsx',
      summary.hodByDepartment.map((h) => ({
        Department: h.departmentName,
        'Pending review': h.pendingReview,
        Approved: h.approved,
        Returned: h.returned,
        Draft: h.draft,
        'Approval rate %': h.approvalRatePct,
      })),
    );
  };

  const exportOutcomes = () => {
    if (!summary) return;
    exportSheet(
      'ambassador-progress-by-outcome.xlsx',
      summary.byOutcome.map((o) => ({
        Outcome: `${o.outcomeType}: ${o.outcomeLabel}`,
        Objective: o.objectiveShort,
        Assignments: o.assignments,
        'Not started': o.notStarted,
        'In progress': o.inProgress,
        'Awaiting HOD': o.awaitingReview,
        Approved: o.approved,
        Returned: o.needsRevision,
        'Fill rate %': o.fillRatePct,
      })),
    );
  };

  const exportAging = () => {
    if (!summary) return;
    exportSheet(
      'hod-review-aging.xlsx',
      summary.agingQueue.map((r) => ({
        Department: r.departmentName,
        Ambassador: r.ambassadorName || '',
        Outcome: r.outcomeLabel,
        Indicator: r.indicatorText,
        'Submitted at': r.submittedAt,
        'Days pending': r.daysPending,
      })),
    );
  };

  const reminderButtons = (
    <div className="d-flex flex-wrap gap-2">
      <Button size="sm" variant="outline-secondary" onClick={() => setRemindAudience('not_started')}>
        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>mail</span>
        Remind not started
      </Button>
      <Button size="sm" variant="outline-secondary" onClick={() => setRemindAudience('in_progress')}>
        Remind in progress
      </Button>
      <Button size="sm" variant="outline-warning" onClick={() => setRemindAudience('ready_to_submit')}>
        Remind ready to submit
      </Button>
      <Button size="sm" variant="outline-primary" onClick={() => setRemindAudience('hod_pending')}>
        Remind HODs (pending)
      </Button>
    </div>
  );

  return (
    <Layout>
      <div className="container-fluid py-3">
        <div className="mb-4">
          <h4 className="fw-bold mb-1">Ambassador Reports</h4>
          <p className="text-muted mb-0 small">
            Track ambassador reporting progress school-wide, by department, objective, and HOD approval status.
            Send reminders to ambassadors and Heads of Department who have outstanding work.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : summary ? (
          <>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="Total assignments" value={summary.totals.assignments} color="blue" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="Not started" value={summary.totals.notStarted} color="red" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="In progress" value={summary.totals.inProgress} color="yellow" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="Awaiting HOD" value={summary.totals.awaitingReview} color="blue" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="Approved" value={summary.totals.approved} color="green" />
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <StatCard label="Overall fill rate" value={`${summary.totals.fillRatePct}%`} color="green" />
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3 border-bottom pb-2">
              {SECTION_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm ${section === tab.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setSection(tab.key)}
                >
                  <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
              <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={load}>
                <span className="material-symbols-outlined align-middle" style={{ fontSize: 16 }}>refresh</span>
              </Button>
            </div>

            {section === 'overview' && (
              <div className="row g-4">
                <div className="col-lg-5">
                  <div className="bg-white p-4 rounded-3 border h-100">
                    <h6 className="fw-bold mb-3">Reporting funnel</h6>
                    <ProgressDonut totals={summary.totals} />
                    <div className="mt-3 small text-muted">
                      Approval rate: <strong>{summary.totals.approvalRatePct}%</strong>
                      {' · '}
                      HOD queue: <strong>{summary.totals.hodPendingCount}</strong>
                      {summary.totals.avgHodPendingDays > 0 ? (
                        <> · Avg. wait: <strong>{summary.totals.avgHodPendingDays} days</strong></>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="col-lg-7">
                  <div className="bg-white p-4 rounded-3 border h-100">
                    <ReportsSectionHeader
                      icon="stacked_bar_chart"
                      title="Fill rate by department"
                      description="Top departments by data entry completion (metric cells filled)."
                    />
                    <DepartmentBarChart rows={summary.byDepartment} />
                  </div>
                </div>
                <div className="col-12">
                  <div className="bg-white p-4 rounded-3 border">
                    <ReportsSectionHeader
                      icon="campaign"
                      title="Send reminders"
                      description="Notify ambassadors or HODs about outstanding questionnaire reporting tasks."
                      filters={reminderButtons}
                    />
                    {remindResult ? <div className="alert alert-info py-2 small mb-0">{remindResult}</div> : null}
                  </div>
                </div>
              </div>
            )}

            {section === 'departments' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="apartment"
                  title="Progress by department / unit"
                  count={summary.byDepartment.length}
                  filters={
                    <Button size="sm" variant="outline-success" onClick={exportDepartments}>
                      <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>download</span>
                      Export
                    </Button>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Department / unit</th>
                        <th>Ambassador</th>
                        <th className="text-center">Assignments</th>
                        <th className="text-center">Not started</th>
                        <th className="text-center">In progress</th>
                        <th className="text-center">Awaiting HOD</th>
                        <th className="text-center">Approved</th>
                        <th className="text-center">Fill %</th>
                        <th className="text-center">Approved %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byDepartment.map((d) => (
                        <tr key={d.departmentId}>
                          <td className="fw-medium">{d.departmentName}</td>
                          <td>
                            {d.ambassadorName || <span className="text-muted">—</span>}
                            {d.ambassadorEmail ? <div className="small text-muted">{d.ambassadorEmail}</div> : null}
                          </td>
                          <td className="text-center">{d.assignments}</td>
                          <td className="text-center">{d.notStarted > 0 ? <Badge bg="secondary">{d.notStarted}</Badge> : 0}</td>
                          <td className="text-center">{d.inProgress > 0 ? <Badge bg="warning" text="dark">{d.inProgress}</Badge> : 0}</td>
                          <td className="text-center">{d.awaitingReview > 0 ? <Badge bg="info">{d.awaitingReview}</Badge> : 0}</td>
                          <td className="text-center">{d.approved > 0 ? <Badge bg="success">{d.approved}</Badge> : 0}</td>
                          <td className="text-center">{d.fillRatePct}%</td>
                          <td className="text-center">{d.approvalRatePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'objectives' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="flag"
                  title="Progress by strategic objective"
                  count={summary.byObjective.length}
                  filters={
                    <Button size="sm" variant="outline-success" onClick={exportObjectives}>
                      Export
                    </Button>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Objective</th>
                        <th className="text-center">Assignments</th>
                        <th className="text-center">Not started</th>
                        <th className="text-center">In progress</th>
                        <th className="text-center">Awaiting HOD</th>
                        <th className="text-center">Approved</th>
                        <th className="text-center">Fill %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byObjective.map((o) => (
                        <tr key={o.objective}>
                          <td>
                            <div className="fw-medium">{o.objectiveShort}</div>
                            <div className="small text-muted text-truncate" style={{ maxWidth: 420 }} title={o.objective}>{o.objective}</div>
                          </td>
                          <td className="text-center">{o.assignments}</td>
                          <td className="text-center">{o.notStarted}</td>
                          <td className="text-center">{o.inProgress}</td>
                          <td className="text-center">{o.awaitingReview}</td>
                          <td className="text-center">{o.approved}</td>
                          <td className="text-center">{o.fillRatePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'outcomes' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="account_tree"
                  title="Progress by outcome / output"
                  count={summary.byOutcome.length}
                  filters={
                    <Button size="sm" variant="outline-success" onClick={exportOutcomes}>
                      Export
                    </Button>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Outcome / output</th>
                        <th>Objective</th>
                        <th className="text-center">Assignments</th>
                        <th className="text-center">Not started</th>
                        <th className="text-center">In progress</th>
                        <th className="text-center">Awaiting HOD</th>
                        <th className="text-center">Approved</th>
                        <th className="text-center">Fill %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byOutcome.map((o) => (
                        <tr key={o.outcomeKey}>
                          <td>
                            <Badge bg="light" text="dark" className="me-1">{o.outcomeType}</Badge>
                            {o.outcomeLabel}
                          </td>
                          <td className="small text-muted">{o.objectiveShort}</td>
                          <td className="text-center">{o.assignments}</td>
                          <td className="text-center">{o.notStarted}</td>
                          <td className="text-center">{o.inProgress}</td>
                          <td className="text-center">{o.awaitingReview}</td>
                          <td className="text-center">{o.approved}</td>
                          <td className="text-center">{o.fillRatePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'hod' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="fact_check"
                  title="HOD approval progress"
                  description="Which departments have submissions waiting for Head of Department approval."
                  count={summary.hodByDepartment.filter((h) => h.pendingReview > 0).length}
                  filters={
                    <>
                      {reminderButtons}
                      <Button size="sm" variant="outline-success" onClick={exportHod}>
                        Export
                      </Button>
                    </>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Department / unit</th>
                        <th className="text-center">Pending review</th>
                        <th className="text-center">Approved</th>
                        <th className="text-center">Returned</th>
                        <th className="text-center">Still in draft</th>
                        <th className="text-center">Approval rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.hodByDepartment.map((h) => (
                        <tr key={h.departmentId} className={h.pendingReview > 0 ? 'table-warning' : undefined}>
                          <td className="fw-medium">{h.departmentName}</td>
                          <td className="text-center">
                            {h.pendingReview > 0 ? <Badge bg="warning" text="dark">{h.pendingReview}</Badge> : 0}
                          </td>
                          <td className="text-center">{h.approved}</td>
                          <td className="text-center">{h.returned}</td>
                          <td className="text-center">{h.draft}</td>
                          <td className="text-center">{h.approvalRatePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'aging' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="schedule"
                  title="HOD review aging"
                  description="Submissions awaiting Head of Department approval, sorted by longest wait."
                  count={summary.agingQueue.length}
                  filters={
                    <>
                      <Button size="sm" variant="outline-primary" onClick={() => setRemindAudience('hod_pending')}>
                        Remind HODs
                      </Button>
                      <Button size="sm" variant="outline-success" onClick={exportAging}>
                        Export
                      </Button>
                    </>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Department</th>
                        <th>Ambassador</th>
                        <th>Indicator</th>
                        <th>Submitted</th>
                        <th className="text-center">Days pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.agingQueue.length === 0 ? (
                        <tr><td colSpan={5} className="text-muted text-center py-4">No submissions currently awaiting HOD review.</td></tr>
                      ) : summary.agingQueue.map((r) => (
                        <tr key={`${r.indicatorId}-${r.departmentId}`} className={r.daysPending >= 7 ? 'table-warning' : undefined}>
                          <td>{r.departmentName}</td>
                          <td>{r.ambassadorName || '—'}</td>
                          <td>
                            <div className="small text-muted">{r.outcomeLabel}</div>
                            {r.indicatorText}
                          </td>
                          <td className="small">{new Date(r.submittedAt).toLocaleDateString()}</td>
                          <td className="text-center">
                            <Badge bg={r.daysPending >= 14 ? 'danger' : r.daysPending >= 7 ? 'warning' : 'secondary'} text={r.daysPending >= 7 ? 'dark' : undefined}>
                              {r.daysPending}d
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'assignments' && (
              <div className="bg-white p-4 rounded-3 border">
                <ReportsSectionHeader
                  icon="list_alt"
                  title="Indicator assignments"
                  count={filteredAssignments.length}
                  filters={
                    <>
                      <input
                        type="search"
                        className="form-control form-control-sm"
                        placeholder="Search department, indicator, ambassador…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ minWidth: 220 }}
                      />
                      <select
                        className="form-select form-select-sm"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                      >
                        <option value="all">All statuses</option>
                        <option value="not-completed">Not completed</option>
                        <option value="awaiting-review">Awaiting HOD</option>
                        <option value="completed">Approved</option>
                        <option value="needs-revision">Returned</option>
                      </select>
                      <Button size="sm" variant="outline-success" onClick={exportAssignments}>
                        Export
                      </Button>
                    </>
                  }
                />
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Department</th>
                        <th>Ambassador</th>
                        <th>Indicator</th>
                        <th>Progress</th>
                        <th>HOD</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.map((a) => (
                        <tr key={`${a.indicatorId}-${a.departmentId}`}>
                          <td>{a.departmentName}</td>
                          <td>{a.ambassadorName || '—'}</td>
                          <td>
                            <div className="small text-muted">{a.outcomeLabel}</div>
                            <div>{a.indicatorText}</div>
                          </td>
                          <td>
                            {PROGRESS_LABELS[a.progressStatus]}
                            <div className="small text-muted">{a.filled}/{a.total} cells</div>
                          </td>
                          <td>{HOD_REVIEW_STATUS_LABELS[a.hodReviewStatus]}</td>
                          <td>
                            <Badge bg={CATEGORY_BADGE[a.reportingCategory].bg}>
                              {CATEGORY_BADGE[a.reportingCategory].label}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'collected-data' && (
              <AmbassadorCollectedDataPanel />
            )}
          </>
        ) : null}
      </div>

      <Modal show={remindAudience != null} onHide={() => !reminding && setRemindAudience(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Send reminder</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {remindAudience === 'hod_pending'
            ? 'Send email and in-app notifications to Heads of Department who have questionnaire submissions awaiting review?'
            : 'Send email and in-app notifications to ambassadors with outstanding reporting for this category?'}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={reminding} onClick={() => setRemindAudience(null)}>Cancel</Button>
          <Button variant="primary" disabled={reminding} onClick={sendReminder}>
            {reminding ? 'Sending…' : 'Send reminders'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
