'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import StatCard from '@/components/StatCard';

const REPORT_TITLE = 'Dept. / Unit Activity Progress';

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

type ActivityRow = {
  id: number;
  title: string;
  department: string;
  departmentId: number;
  status: string;
  progress: number;
  endDate: string | null;
};

type ActivityFilter = 'all' | 'delayed' | 'in-progress' | 'on-track';

function progressBarColor(progress: number): string {
  if (progress > 70) return '#10b981';
  if (progress > 40) return '#f59e0b';
  return '#ef4444';
}

function matchesActivityStatusFilter(status: string, filter: ActivityFilter): boolean {
  const normalized = status.trim().toLowerCase();
  switch (filter) {
    case 'delayed':
      return normalized === 'delayed';
    case 'in-progress':
      return normalized === 'in progress';
    case 'on-track':
      return normalized === 'on track';
    default:
      return true;
  }
}

function activityStatusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'on track') return 'bg-success-subtle text-success border border-success';
  if (normalized === 'in progress') return 'bg-warning-subtle text-warning border border-warning';
  if (normalized === 'delayed') return 'bg-danger-subtle text-danger border border-danger';
  return 'bg-light text-muted border';
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
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const reportingCycle = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compRes, actRes] = await Promise.all([
        axios.get('/api/ambassador/compliance'),
        axios.get('/api/ambassador/compliance/activities', { params: { all: 'true' } }),
      ]);
      setSummary(compRes.data.summary);
      setDepartments(compRes.data.departments ?? []);
      setRiskAlerts(compRes.data.riskAlerts ?? []);
      setSubmissionMonths(compRes.data.submissionMonths ?? []);
      setActivities(actRes.data.activities ?? []);
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

  const departmentByName = useMemo(
    () => new Map(departments.map((d) => [d.name, d])),
    [departments]
  );

  const filteredActivities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activities.filter((activity) => {
      if (departmentFilter !== 'All Departments' && activity.department !== departmentFilter) {
        return false;
      }
      if (!matchesActivityStatusFilter(activity.status, activityFilter)) return false;
      if (monthlyReportFilter !== 'all') {
        const dept = departmentByName.get(activity.department);
        if (!dept || dept.monthlyReportStatus !== monthlyReportFilter) return false;
      }
      if (q) {
        const inTitle = activity.title.toLowerCase().includes(q);
        const inDept = activity.department.toLowerCase().includes(q);
        if (!inTitle && !inDept) return false;
      }
      return true;
    });
  }, [activities, departmentFilter, activityFilter, monthlyReportFilter, searchTerm, departmentByName]);

  const selectedDepartment = useMemo(() => {
    if (departmentFilter === 'All Departments') return null;
    return departments.find((d) => d.name === departmentFilter) ?? null;
  }, [departments, departmentFilter]);

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

  const getExportActivities = (): ActivityRow[] => filteredActivities;

  const exportPDF = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const allActivities = getExportActivities();
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

      let nextY = metaY + 8;

      if (allActivities.length > 0) {
        autoTable(doc, {
          startY: nextY,
          head: [['Activity', 'Status', 'Progress', 'Due date']],
          body: allActivities.map((a) => [
            a.title,
            a.status,
            `${a.progress}%`,
            a.endDate ? new Date(a.endDate).toLocaleDateString() : '—',
          ]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [30, 92, 164], textColor: 255, fontStyle: 'bold' },
        });
        nextY =
          (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 20;
      }

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

      doc.save('Departmental_Compliance_Tracker.pdf');
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const allActivities = getExportActivities();
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
        ...departments.map((dept) => [
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
          ['Activity', 'Status', 'Progress %', 'Due date'],
          ...allActivities.map((a) => [a.title, a.status, a.progress, a.endDate || '']),
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
        Monitor strategic plan activities and monthly staff reporting for your department or unit.
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
            <h5 className="mb-0 fw-bold">Dept. / Unit Activity Progress</h5>
            <p className="mb-0 small text-muted mt-1">Strategic activities across your managed departments</p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <input
              type="search"
              className="form-control form-control-sm"
              style={{ width: '160px' }}
              placeholder="Search activity…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search activities"
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
              <option value="on-track">On track</option>
              <option value="in-progress">In progress</option>
              <option value="delayed">Delayed</option>
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
              disabled={exporting || filteredActivities.length === 0}
            >
              PDF
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary fw-bold"
              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
              onClick={exportExcel}
              disabled={exporting || filteredActivities.length === 0}
            >
              <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>
                download
              </span>
              Excel
            </button>
          </div>
        </div>

        {selectedDepartment && (
          <div className="px-4 py-2 border-bottom bg-light d-flex flex-wrap align-items-center gap-3 small">
            <span className="text-muted">
              Monthly report ({reportingCycle}):{' '}
              <span
                className={`badge rounded-pill ${selectedDepartment.monthlyReportStatus === 'submitted' ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'}`}
                style={{ fontSize: '.65rem', fontWeight: 800 }}
              >
                {selectedDepartment.monthlyReportStatus === 'submitted' ? 'SUBMITTED' : 'PENDING'}
              </span>
            </span>
            {selectedDepartment.lastSubmission && (
              <span className="text-muted">
                Last submission: {new Date(selectedDepartment.lastSubmission).toLocaleDateString()}
              </span>
            )}
            <span className="text-muted d-flex align-items-center gap-1" title={submissionMonths.join(' → ')}>
              6-mo history:
              {selectedDepartment.submissionHistory.map((h, i) => (
                <span
                  key={`${selectedDepartment.id}-hist-${i}`}
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
            </span>
          </div>
        )}

        <div className="table-responsive p-0">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  ACTIVITY
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  PROGRESS
                </th>
                <th className="py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  STATUS
                </th>
                <th className="px-4 py-3 border-0" style={{ fontSize: '.7rem', fontWeight: 800 }}>
                  DUE DATE
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-5 small">
                    No activities match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-4">
                      <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>
                        {activity.title}
                      </div>
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
                              width: `${activity.progress}%`,
                              background: progressBarColor(activity.progress),
                            }}
                          />
                        </div>
                        <span className="small fw-bold">{activity.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge rounded-pill px-2 py-1 ${activityStatusBadgeClass(activity.status)}`}
                        style={{ fontSize: '.65rem', fontWeight: 800 }}
                      >
                        {activity.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 small">
                      {activity.endDate ? new Date(activity.endDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card-footer d-flex flex-wrap justify-content-between gap-2">
          <span className="footer-label">
            Showing {filteredActivities.length} of {activities.length} activities
          </span>
          {!filtersAtDefault && (
            <span className="text-muted small">Filters applied — export uses current view</span>
          )}
        </div>
      </div>
    </>
  );
}
