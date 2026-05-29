'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import StatCard from '@/components/StatCard';

const REPORT_TITLE = 'Departmental Compliance Tracker';

type ComplianceSummary = {
  managedUnitName: string;
  totalDepartments: number;
  totalActivities: number;
  overallProgress: number;
  onTrack: number;
  inProgress: number;
  delayed: number;
  monthlyReportingRate: number;
  departmentsReportedThisMonth: number;
};

type DepartmentRow = {
  id: number;
  name: string;
  activityCount: number;
  progress: number;
  onTrack: number;
  inProgress: number;
  delayed: number;
  monthlyReportStatus: 'submitted' | 'pending';
  lastSubmission: string | null;
  submissionHistory: Array<{ month: string; year: number; status: 'submitted' | 'missing' }>;
};

type RiskAlert = {
  id: number;
  title: string;
  department: string;
  departmentId: number;
  status: 'Critical' | 'Warning';
  progress: number;
  dueDate: string | null;
};

type DepartmentActivity = {
  id: number;
  title: string;
  status: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
};

type ExportActivity = DepartmentActivity & { department: string; departmentId: number };

type ActivityFilter =
  | 'all'
  | 'with'
  | 'none'
  | 'delayed'
  | 'in-progress'
  | 'on-track';

function progressBarColor(progress: number): string {
  if (progress > 70) return '#10b981';
  if (progress > 40) return '#f59e0b';
  return '#ef4444';
}

function deptActivityStatusLabel(dept: DepartmentRow): string {
  const parts: string[] = [];
  if (dept.onTrack > 0) parts.push(`${dept.onTrack} on track`);
  if (dept.inProgress > 0) parts.push(`${dept.inProgress} in progress`);
  if (dept.delayed > 0) parts.push(`${dept.delayed} delayed`);
  if (parts.length === 0) return dept.activityCount === 0 ? 'No activities' : '—';
  return parts.join(' · ');
}

function matchesActivityFilter(dept: DepartmentRow, filter: ActivityFilter): boolean {
  switch (filter) {
    case 'with':
      return dept.activityCount > 0;
    case 'none':
      return dept.activityCount === 0;
    case 'delayed':
      return dept.delayed > 0;
    case 'in-progress':
      return dept.inProgress > 0;
    case 'on-track':
      return dept.onTrack > 0;
    default:
      return true;
  }
}

function submissionHistoryLabel(
  history: DepartmentRow['submissionHistory'],
  months: string[]
): string {
  return months
    .map((monthLabel, i) => {
      const h = history[i];
      if (!h) return `${monthLabel}: —`;
      return `${monthLabel}: ${h.status === 'submitted' ? 'Yes' : 'No'}`;
    })
    .join(' | ');
}

export default function AmbassadorCompliancePanel() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [submissionMonths, setSubmissionMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [monthlyReportFilter, setMonthlyReportFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedDeptId, setExpandedDeptId] = useState<number | null>(null);
  const [deptActivities, setDeptActivities] = useState<DepartmentActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const reportingCycle = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const compRes = await axios.get('/api/ambassador/compliance');
      setSummary(compRes.data.summary);
      setDepartments(compRes.data.departments ?? []);
      setRiskAlerts(compRes.data.riskAlerts ?? []);
      setSubmissionMonths(compRes.data.submissionMonths ?? []);
    } catch (err: unknown) {
      console.error('Compliance fetch error:', err);
      setError('Failed to load departmental compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const departmentOptions = useMemo(
    () => ['All Departments', ...departments.map((d) => d.name)],
    [departments]
  );

  const filteredDepartments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return departments.filter((dept) => {
      if (departmentFilter !== 'All Departments' && dept.name !== departmentFilter) return false;
      if (!matchesActivityFilter(dept, activityFilter)) return false;
      if (monthlyReportFilter === 'submitted' && dept.monthlyReportStatus !== 'submitted') return false;
      if (monthlyReportFilter === 'pending' && dept.monthlyReportStatus !== 'pending') return false;
      if (q && !dept.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [departments, departmentFilter, activityFilter, monthlyReportFilter, searchTerm]);

  const filteredRiskAlerts = useMemo(() => {
    if (departmentFilter === 'All Departments') return riskAlerts;
    return riskAlerts.filter((a) => a.department === departmentFilter);
  }, [riskAlerts, departmentFilter]);

  const filtersAtDefault =
    departmentFilter === 'All Departments' &&
    activityFilter === 'all' &&
    monthlyReportFilter === 'all' &&
    !searchTerm.trim();

  const resetFilters = () => {
    setDepartmentFilter('All Departments');
    setActivityFilter('all');
    setMonthlyReportFilter('all');
    setSearchTerm('');
  };

  const loadDepartmentActivities = useCallback(async (departmentId: number) => {
    if (expandedDeptId === departmentId) {
      setExpandedDeptId(null);
      setDeptActivities([]);
      return;
    }

    setExpandedDeptId(departmentId);
    setActivitiesLoading(true);
    setActivitiesError(null);
    setDeptActivities([]);
    try {
      const res = await axios.get('/api/ambassador/compliance/activities', {
        params: { departmentId },
      });
      setDeptActivities(res.data.activities ?? []);
    } catch {
      setActivitiesError('Could not load activities for this department');
    } finally {
      setActivitiesLoading(false);
    }
  }, [expandedDeptId]);

  const fetchExportActivities = async (): Promise<ExportActivity[]> => {
    const res = await axios.get('/api/ambassador/compliance/activities', {
      params: { all: 'true' },
    });
    const rows = (res.data.activities ?? []) as Array<{
      id: number;
      title: string;
      department: string;
      departmentId: number;
      status: string;
      progress: number;
      endDate: string | null;
    }>;
    let list: ExportActivity[] = rows.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      progress: a.progress,
      department: a.department,
      departmentId: a.departmentId,
      startDate: null,
      endDate: a.endDate,
    }));
    if (departmentFilter !== 'All Departments') {
      list = list.filter((a) => a.department === departmentFilter);
    }
    return list;
  };

  const buildDeptTableBody = (rows: DepartmentRow[]) =>
    rows.map((dept) => [
      dept.name,
      String(dept.activityCount),
      `${dept.progress}%`,
      deptActivityStatusLabel(dept),
      dept.monthlyReportStatus === 'submitted' ? 'Submitted' : 'Pending',
      dept.lastSubmission ? new Date(dept.lastSubmission).toLocaleDateString() : '—',
      submissionHistoryLabel(dept.submissionHistory, submissionMonths),
    ]);

  const exportPDF = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const allActivities = await fetchExportActivities();
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(12);
      doc.text(REPORT_TITLE, 14, 15);
      doc.setFontSize(9);
      let metaY = 22;
      doc.text(`Faculty / office: ${summary.managedUnitName}`, 14, metaY);
      metaY += 6;
      doc.text(`Reporting cycle: ${reportingCycle}`, 14, metaY);
      metaY += 6;
      doc.text(
        `Faculty progress: ${summary.overallProgress}% · Activities: ${summary.totalActivities} · On track: ${summary.onTrack} · In progress: ${summary.inProgress} · Delayed: ${summary.delayed}`,
        14,
        metaY
      );
      metaY += 6;
      doc.text(
        `Monthly reporting: ${summary.monthlyReportingRate}% (${summary.departmentsReportedThisMonth}/${summary.totalDepartments} departments)`,
        14,
        metaY
      );
      metaY += 6;
      if (!filtersAtDefault) {
        doc.text(
          `Filters: Dept=${departmentFilter}, Activities=${activityFilter}, Monthly=${monthlyReportFilter}${searchTerm ? `, Search="${searchTerm}"` : ''}`,
          14,
          metaY
        );
        metaY += 6;
      }
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, metaY);

      autoTable(doc, {
        startY: metaY + 8,
        head: [
          [
            'Department',
            'Activities',
            'Progress',
            'Activity status',
            'Monthly report',
            'Last submission',
            '6-month history',
          ],
        ],
        body: buildDeptTableBody(filteredDepartments),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
      });

      let nextY =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? metaY + 40;

      if (filteredRiskAlerts.length > 0) {
        doc.setFontSize(10);
        doc.text('Activities requiring attention', 14, nextY + 10);
        autoTable(doc, {
          startY: nextY + 14,
          head: [['Activity', 'Department', 'Due', 'Progress', 'Risk']],
          body: filteredRiskAlerts.map((a) => [
            a.title,
            a.department,
            a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—',
            `${a.progress}%`,
            a.status,
          ]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
        });
        nextY =
          (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 20;
      }

      if (allActivities.length > 0) {
        doc.setFontSize(10);
        doc.text('Strategic activities (detail)', 14, nextY + 10);
        autoTable(doc, {
          startY: nextY + 14,
          head: [['Department', 'Activity', 'Status', 'Progress', 'End date']],
          body: allActivities.map((a) => [
            a.department,
            a.title,
            a.status,
            `${a.progress}%`,
            a.endDate ? new Date(a.endDate).toLocaleDateString() : '—',
          ]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
        });
      }

      doc.save('Departmental_Compliance_Tracker.pdf');
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const allActivities = await fetchExportActivities();
      const wb = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.aoa_to_sheet([
        [REPORT_TITLE],
        ['Faculty / office', summary.managedUnitName],
        ['Reporting cycle', reportingCycle],
        ['Faculty strategic progress', `${summary.overallProgress}%`],
        ['Total activities', summary.totalActivities],
        ['On track', summary.onTrack],
        ['In progress', summary.inProgress],
        ['Delayed / at risk', summary.delayed],
        [
          'Monthly reporting',
          `${summary.monthlyReportingRate}% (${summary.departmentsReportedThisMonth}/${summary.totalDepartments})`,
        ],
        ['Generated', new Date().toLocaleString()],
        [],
        [
          'Department',
          'Activities',
          'Progress %',
          'On track',
          'In progress',
          'Delayed',
          'Monthly report',
          'Last submission',
          ...submissionMonths.map((m) => `${m} submitted`),
        ],
        ...filteredDepartments.map((dept) => [
          dept.name,
          dept.activityCount,
          dept.progress,
          dept.onTrack,
          dept.inProgress,
          dept.delayed,
          dept.monthlyReportStatus,
          dept.lastSubmission || '',
          ...dept.submissionHistory.map((h) => (h.status === 'submitted' ? 'Yes' : 'No')),
        ]),
      ]);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Departments');

      if (filteredRiskAlerts.length > 0) {
        const alertsSheet = XLSX.utils.aoa_to_sheet([
          ['Activity', 'Department', 'Due date', 'Progress %', 'Risk'],
          ...filteredRiskAlerts.map((a) => [
            a.title,
            a.department,
            a.dueDate || '',
            a.progress,
            a.status,
          ]),
        ]);
        XLSX.utils.book_append_sheet(wb, alertsSheet, 'Risk alerts');
      }

      if (allActivities.length > 0) {
        const actSheet = XLSX.utils.aoa_to_sheet([
          ['Department', 'Activity', 'Status', 'Progress %', 'End date'],
          ...allActivities.map((a) => [
            a.department,
            a.title,
            a.status,
            a.progress,
            a.endDate || '',
          ]),
        ]);
        XLSX.utils.book_append_sheet(wb, actSheet, 'Activities');
      }

      XLSX.writeFile(wb, 'Departmental_Compliance_Tracker.xlsx');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3">
        <span className="material-symbols-outlined">error</span>
        <p className="mb-0 small">{error || 'Unable to load compliance data'}</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-muted small mb-4">
        Monitor strategic plan activities and monthly staff reporting across departments in your faculty.
      </p>

      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Faculty Strategic Progress" value={`${summary.overallProgress}%`} color="blue" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Strategic Activities" value={summary.totalActivities} color="blue" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="On Track" value={summary.onTrack} color="green" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="In Progress" value={summary.inProgress} color="yellow" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Delayed / At Risk" value={summary.delayed} color="red" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label={`Monthly Reporting · ${reportingCycle}`}
            value={`${summary.monthlyReportingRate}% (${summary.departmentsReportedThisMonth}/${summary.totalDepartments})`}
            color="blue"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Departments" value={summary.totalDepartments} color="green" />
        </div>
      </div>

      {filteredRiskAlerts.length > 0 && (
        <div className="table-card shadow-sm border-0 bg-white mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div className="p-3 border-bottom bg-danger-subtle">
            <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
              <span className="material-symbols-outlined text-danger">crisis_alert</span>
              Activities requiring attention
            </h6>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-3 py-2 border-0 small fw-bold">ACTIVITY</th>
                  <th className="py-2 border-0 small fw-bold">DEPARTMENT</th>
                  <th className="py-2 border-0 small fw-bold">DUE</th>
                  <th className="py-2 border-0 small fw-bold">PROGRESS</th>
                  <th className="px-3 py-2 border-0 small fw-bold">RISK</th>
                </tr>
              </thead>
              <tbody>
                {filteredRiskAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-3 small fw-semibold">{alert.title}</td>
                    <td className="small">{alert.department}</td>
                    <td className="small">
                      {alert.dueDate ? new Date(alert.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="small">{alert.progress}%</td>
                    <td className="px-3">
                      <span
                        className={`badge rounded-pill ${alert.status === 'Critical' ? 'bg-danger' : 'bg-warning text-dark'}`}
                        style={{ fontSize: '.6rem' }}
                      >
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-card-header flex-wrap gap-2">
          <div>
            <h5 className="mb-0 fw-bold">Departmental Compliance Tracker</h5>
            <p className="mb-0 small text-muted mt-1">Strategic activities and monthly reporting by department</p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <input
              type="search"
              className="form-control form-control-sm"
              style={{ width: '160px' }}
              placeholder="Search department…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search departments"
            />
            <select
              className="form-select form-select-sm"
              style={{ width: '200px' }}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              style={{ width: '170px' }}
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
              aria-label="Filter by activity status"
            >
              <option value="all">All activity states</option>
              <option value="with">With activities</option>
              <option value="none">No activities</option>
              <option value="on-track">Has on track</option>
              <option value="in-progress">Has in progress</option>
              <option value="delayed">Has delayed</option>
            </select>
            <select
              className="form-select form-select-sm"
              style={{ width: '150px' }}
              value={monthlyReportFilter}
              onChange={(e) => setMonthlyReportFilter(e.target.value as 'all' | 'submitted' | 'pending')}
              aria-label="Filter by monthly report"
            >
              <option value="all">All monthly reports</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
            </select>
            <button
              type="button"
              className="btn btn-sm btn-light border fw-bold"
              onClick={resetFilters}
              disabled={filtersAtDefault}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary fw-bold"
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger fw-bold"
              onClick={exportPDF}
              disabled={exporting || filteredDepartments.length === 0}
            >
              PDF
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary fw-bold"
              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
              onClick={exportExcel}
              disabled={exporting || filteredDepartments.length === 0}
            >
              <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>
                download
              </span>
              Excel
            </button>
          </div>
        </div>

        <div className="table-responsive p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  DEPARTMENT
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  ACTIVITIES
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  PROGRESS
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  STATUS
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  MONTHLY REPORT
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  6-MO HISTORY
                </th>
                <th className="px-4 py-3 border-0 text-end" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-5 small">
                    No departments match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => (
                  <Fragment key={dept.id}>
                    <tr>
                      <td className="px-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>
                          {dept.name}
                        </div>
                        <div className="text-muted" style={{ fontSize: '.65rem' }}>
                          {deptActivityStatusLabel(dept)}
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold">{dept.activityCount}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="progress flex-fill"
                            style={{ height: '6px', width: '72px', background: '#f1f5f9' }}
                          >
                            <div
                              className="progress-bar"
                              style={{
                                width: `${dept.progress}%`,
                                background: progressBarColor(dept.progress),
                              }}
                            />
                          </div>
                          <span className="small fw-bold">{dept.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {dept.onTrack > 0 && (
                            <span
                              className="badge bg-success-subtle text-success border border-success"
                              style={{ fontSize: '.6rem' }}
                            >
                              {dept.onTrack} on track
                            </span>
                          )}
                          {dept.inProgress > 0 && (
                            <span
                              className="badge bg-warning-subtle text-warning border border-warning"
                              style={{ fontSize: '.6rem' }}
                            >
                              {dept.inProgress} active
                            </span>
                          )}
                          {dept.delayed > 0 && (
                            <span
                              className="badge bg-danger-subtle text-danger border border-danger"
                              style={{ fontSize: '.6rem' }}
                            >
                              {dept.delayed} delayed
                            </span>
                          )}
                          {dept.activityCount === 0 && (
                            <span className="badge bg-light text-muted border" style={{ fontSize: '.6rem' }}>
                              No activities
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2 py-1 ${dept.monthlyReportStatus === 'submitted' ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'}`}
                          style={{ fontSize: '.65rem', fontWeight: 800 }}
                        >
                          {dept.monthlyReportStatus === 'submitted' ? 'SUBMITTED' : 'PENDING'}
                        </span>
                        {dept.lastSubmission && (
                          <div className="text-muted mt-1" style={{ fontSize: '.6rem' }}>
                            Last: {new Date(dept.lastSubmission).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1 align-items-center" title={submissionMonths.join(' → ')}>
                          {dept.submissionHistory.map((h, i) => (
                            <span
                              key={`${dept.id}-${i}`}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: h.status === 'submitted' ? '#10b981' : '#e2e8f0',
                                border: h.status === 'submitted' ? 'none' : '1px solid #cbd5e1',
                                display: 'inline-block',
                              }}
                              title={`${h.month} ${h.year}: ${h.status}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                          style={{ fontSize: '.65rem' }}
                          onClick={() => loadDepartmentActivities(dept.id)}
                        >
                          {expandedDeptId === dept.id ? 'Hide' : 'View'} Activities
                        </button>
                      </td>
                    </tr>
                    {expandedDeptId === dept.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-light">
                          {activitiesLoading && (
                            <div className="text-center py-3">
                              <div className="spinner-border spinner-border-sm text-primary" role="status" />
                            </div>
                          )}
                          {activitiesError && (
                            <p className="small text-danger mb-0">{activitiesError}</p>
                          )}
                          {!activitiesLoading && !activitiesError && deptActivities.length === 0 && (
                            <p className="small text-muted mb-0">No strategic activities linked to this department.</p>
                          )}
                          {!activitiesLoading && deptActivities.length > 0 && (
                            <div className="table-responsive">
                              <table className="table table-sm table-bordered bg-white mb-0">
                                <thead>
                                  <tr>
                                    <th className="small">Activity</th>
                                    <th className="small">Status</th>
                                    <th className="small">Progress</th>
                                    <th className="small">End date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {deptActivities.map((a) => (
                                    <tr key={a.id}>
                                      <td className="small fw-semibold">{a.title}</td>
                                      <td className="small">{a.status}</td>
                                      <td className="small">{a.progress}%</td>
                                      <td className="small">
                                        {a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card-footer d-flex flex-wrap justify-content-between gap-2">
          <span className="footer-label">
            Showing {filteredDepartments.length} of {departments.length} departments
          </span>
          {!filtersAtDefault && (
            <span className="text-muted small">Filters applied — export uses current view</span>
          )}
        </div>
      </div>
    </>
  );
}
