'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'annual' | 'financial_year';
type ActivityScope = 'all' | 'strategic' | 'departmental';

interface PerfSeriesPoint {
  periodLabel: string;
  periodKey: string;
  complete: number;
  incomplete: number;
  notDone: number;
  total: number;
  pointsEarned: number;
  performancePercent: number;
}

interface StaffPerfRow {
  staffId: number;
  staffName: string;
  complete: number;
  incomplete: number;
  notDone: number;
  total: number;
  performancePercent: number;
}

interface DepartmentPerformanceResponse {
  performancePercent: number | null;
  totalPoints: number;
  maxPoints: number;
  period: Period;
  timeSeries: PerfSeriesPoint[];
  byStaff: StaffPerfRow[];
}

interface TaskRow {
  id: number;
  title: string;
  status: string;
  progress: number;
  activity_title?: string;
  activity_id?: number;
  assignee_name?: string;
  source?: string | null;
}

interface DepartmentSummary {
  activity: string;
  tasks: number;
  completed: number;
  inProgress: number;
  delayedOrIncomplete: number;
  avgProgress: number;
  score: string;
}

type ViewTab = 'overview' | 'staff' | 'trends';

const scoreLabel = (pct: number) =>
  pct >= 80
    ? 'Exceptional'
    : pct >= 65
      ? 'Exceeds Expectations'
      : pct >= 50
        ? 'Meets Expectations'
        : 'Below Expectations';

const scoreStyle = (label: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Exceptional': { bg: '#dcfce7', color: '#15803d' },
    'Exceeds Expectations': { bg: '#fef9c3', color: '#a16207' },
    'Meets Expectations': { bg: '#fde8d8', color: '#c2410c' },
    'Below Expectations': { bg: '#fee2e2', color: '#b91c1c' },
  };
  return map[label] || { bg: '#f1f5f9', color: '#475569' };
};

export default function DepartmentReports() {
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [period, setPeriod] = useState<Period>('month');
  const [activityScope, setActivityScope] = useState<ActivityScope>('all');
  const [performance, setPerformance] = useState<DepartmentPerformanceResponse | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const fetchPerformance = async (p: Period, scope: ActivityScope) => {
    setLoadingPerf(true);
    try {
      const { data } = await axios.get(`/api/department-head/performance?period=${p}&source=${scope}`);
      setPerformance(data as DepartmentPerformanceResponse);
    } catch (e) {
      console.error('department performance fetch error', e);
      setPerformance(null);
    } finally {
      setLoadingPerf(false);
    }
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const { data } = await axios.get('/api/department-head/tasks');
      const k = data?.kanban || {};
      const flat = [
        ...(Array.isArray(k.todo) ? k.todo : []),
        ...(Array.isArray(k.inProgress) ? k.inProgress : []),
        ...(Array.isArray(k.underReview) ? k.underReview : []),
        ...(Array.isArray(k.completed) ? k.completed : []),
      ] as TaskRow[];
      setTasks(flat);
    } catch (e) {
      console.error('department tasks fetch error', e);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    fetchPerformance(period, activityScope);
  }, [period, activityScope]);

  const scopeMatchesTask = (task: TaskRow): boolean => {
    const source = String(task.source || '').trim();
    if (activityScope === 'strategic') return source === 'strategic_plan';
    if (activityScope === 'departmental') return source === '';
    return true;
  };

  const filteredTasks = useMemo(() => tasks.filter(scopeMatchesTask), [tasks, activityScope]);

  const activitySummaries = useMemo<DepartmentSummary[]>(() => {
    const groups = new Map<string, TaskRow[]>();
    for (const t of filteredTasks) {
      const name = (t.activity_title || 'Untitled activity').trim() || 'Untitled activity';
      const arr = groups.get(name) || [];
      arr.push(t);
      groups.set(name, arr);
    }
    return Array.from(groups.entries())
      .map(([activity, rows]) => {
        const tasksCount = rows.length;
        const completed = rows.filter((r) => r.status === 'Completed').length;
        const inProgress = rows.filter((r) => ['In Progress', 'On Track', 'Under Review'].includes(r.status)).length;
        const delayedOrIncomplete = rows.filter((r) => ['Delayed', 'Incomplete', 'Not Done'].includes(r.status)).length;
        const avgProgress = tasksCount > 0
          ? Math.round(rows.reduce((sum, r) => sum + Number(r.progress || 0), 0) / tasksCount)
          : 0;
        return {
          activity,
          tasks: tasksCount,
          completed,
          inProgress,
          delayedOrIncomplete,
          avgProgress,
          score: scoreLabel(avgProgress),
        };
      })
      .sort((a, b) => b.avgProgress - a.avgProgress);
  }, [filteredTasks]);

  const staffRows = useMemo(() => performance?.byStaff || [], [performance]);
  const trendRows = useMemo(() => performance?.timeSeries || [], [performance]);

  const overviewTotals = useMemo(() => {
    const totals = activitySummaries.reduce(
      (acc, a) => ({
        tasks: acc.tasks + a.tasks,
        completed: acc.completed + a.completed,
        inProgress: acc.inProgress + a.inProgress,
        delayedOrIncomplete: acc.delayedOrIncomplete + a.delayedOrIncomplete,
        progressSum: acc.progressSum + a.avgProgress,
      }),
      { tasks: 0, completed: 0, inProgress: 0, delayedOrIncomplete: 0, progressSum: 0 }
    );
    const avgProgress = activitySummaries.length
      ? Math.round(totals.progressSum / activitySummaries.length)
      : 0;
    return { ...totals, avgProgress };
  }, [activitySummaries]);

  const avgTrendPerformance = useMemo(() => {
    if (!trendRows.length) return 0;
    return Math.round(trendRows.reduce((sum, r) => sum + Number(r.performancePercent || 0), 0) / trendRows.length);
  }, [trendRows]);

  const exportExcel = (dataset: 'overview' | 'staff') => {
    const rows =
      dataset === 'overview'
        ? activitySummaries.map((a) => ({
            Activity: a.activity,
            'Total Tasks': a.tasks,
            Completed: a.completed,
            'In Progress': a.inProgress,
            'Delayed / Incomplete': a.delayedOrIncomplete,
            'Avg Progress (%)': a.avgProgress,
            Score: a.score,
          }))
        : staffRows.map((s) => ({
            'Staff Name': s.staffName,
            Complete: s.complete,
            Incomplete: s.incomplete,
            'Not Done': s.notDone,
            'Items Reviewed': s.total,
            'Performance (%)': s.performancePercent,
            Score: scoreLabel(s.performancePercent),
          }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `HOD_${dataset}_report_${stamp}.xlsx`);
  };

  const exportPDF = async (dataset: 'overview' | 'staff') => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    const stamp = new Date().toLocaleString();
    doc.setFontSize(14);
    doc.text(`HOD ${dataset === 'overview' ? 'Activity' : 'Staff'} Performance Report`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${stamp}`, 14, 22);
    if (dataset === 'overview') {
      autoTable(doc, {
        startY: 28,
        head: [['Activity', 'Total Tasks', 'Completed', 'In Progress', 'Delayed/Incomplete', 'Avg Progress', 'Score']],
        body: activitySummaries.map((a) => [
          a.activity,
          a.tasks,
          a.completed,
          a.inProgress,
          a.delayedOrIncomplete,
          `${a.avgProgress}%`,
          a.score,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 92, 164] },
      });
    } else {
      autoTable(doc, {
        startY: 28,
        head: [['Staff Name', 'Complete', 'Incomplete', 'Not Done', 'Items Reviewed', 'Performance', 'Score']],
        body: staffRows.map((s) => [
          s.staffName,
          s.complete,
          s.incomplete,
          s.notDone,
          s.total,
          `${s.performancePercent}%`,
          scoreLabel(s.performancePercent),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 92, 164] },
      });
    }
    doc.save(`HOD_${dataset}_performance_report.pdf`);
  };

  return (
    <div className="page-section active-page position-relative">
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="stat-card">
            <div className="stat-label">Department Performance</div>
            <div className="stat-value">{performance?.performancePercent ?? 0}%</div>
            <div className="small text-muted">Based on evaluated staff submissions</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="stat-card">
            <div className="stat-label">Total Points</div>
            <div className="stat-value">{performance?.totalPoints ?? 0} / {performance?.maxPoints ?? 0}</div>
            <div className="small text-muted">Complete=2, Incomplete=1, Not done=0</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="stat-card">
            <div className="stat-label">Activities Tracked</div>
            <div className="stat-value">{activitySummaries.length}</div>
            <div className="small text-muted">Departmental and strategic process tasks</div>
          </div>
        </div>
      </div>

      <div className="table-card mb-4 p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h6 className="fw-bold m-0 d-flex align-items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>analytics</span>
            HOD Performance Metrics & Reports
          </h6>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <label className="small fw-bold mb-0">Activity</label>
            <select
              className="form-select form-select-sm"
              style={{ width: '170px' }}
              value={activityScope}
              onChange={(e) => setActivityScope(e.target.value as ActivityScope)}
            >
              <option value="all">All activities</option>
              <option value="strategic">Strategic activities</option>
              <option value="departmental">Departmental activities</option>
            </select>
            <label className="small fw-bold mb-0">Period</label>
            <select
              className="form-select form-select-sm"
              style={{ width: '150px' }}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="financial_year">Financial year</option>
            </select>
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs border-0 mb-4 gap-2">
        <li className="nav-item">
          <button
            className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'overview' ? 'active bg-primary text-white border-primary' : 'text-muted'}`}
            onClick={() => setActiveTab('overview')}
          >
            Activity Performance
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'staff' ? 'active bg-primary text-white border-primary' : 'text-muted'}`}
            onClick={() => setActiveTab('staff')}
          >
            Staff Performance
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link border rounded-pill px-4 fw-bold ${activeTab === 'trends' ? 'active bg-primary text-white border-primary' : 'text-muted'}`}
            onClick={() => setActiveTab('trends')}
          >
            Performance Trends
          </button>
        </li>
      </ul>

      {activeTab === 'overview' && (
        <div className="table-card mb-4">
          <div className="table-card-header">
            <h5>
              <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>bar_chart</span>
              Activity Performance Summary
            </h5>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => exportPDF('overview')}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                PDF
              </button>
              <button className="btn btn-sm btn-success fw-bold" onClick={() => exportExcel('overview')}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                Excel
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Total Tasks</th>
                  <th>Completed</th>
                  <th>In Progress</th>
                  <th>Delayed / Incomplete</th>
                  <th>Avg Progress</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {loadingTasks ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : activitySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">No activity performance data found</td>
                  </tr>
                ) : (
                  activitySummaries.map((a) => {
                    const style = scoreStyle(a.score);
                    return (
                      <tr key={a.activity}>
                        <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{a.activity}</td>
                        <td>{a.tasks}</td>
                        <td><span className="badge bg-success">{a.completed}</span></td>
                        <td><span className="badge bg-warning text-dark">{a.inProgress}</span></td>
                        <td><span className={`badge ${a.delayedOrIncomplete === 0 ? 'bg-success' : 'bg-danger'}`}>{a.delayedOrIncomplete}</span></td>
                        <td>
                          <div className="progress-bar-custom" style={{ width: '100px', display: 'inline-block', verticalAlign: 'middle' }}>
                            <div className="progress-bar-fill" style={{ width: `${a.avgProgress}%`, background: a.avgProgress >= 70 ? '#10b981' : a.avgProgress >= 50 ? '#ffcd00' : '#e31837' }} />
                          </div>
                          <span style={{ fontSize: '.75rem', marginLeft: '6px' }}>{a.avgProgress}%</span>
                        </td>
                        <td>
                          <span className="status-badge" style={{ background: style.bg, color: style.color }}>{a.score}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!loadingTasks && activitySummaries.length > 0 && (
                  <tr style={{ background: '#f8fafc' }}>
                    <td className="fw-bold" style={{ color: 'var(--mubs-blue)' }}>TOTAL / AVG</td>
                    <td className="fw-bold text-dark">{overviewTotals.tasks}</td>
                    <td><span className="fw-bold text-success">{overviewTotals.completed}</span></td>
                    <td><span className="fw-bold" style={{ color: '#b45309' }}>{overviewTotals.inProgress}</span></td>
                    <td><span className="fw-bold text-danger">{overviewTotals.delayedOrIncomplete}</span></td>
                    <td><span className="fw-bold" style={{ color: 'var(--mubs-blue)' }}>{overviewTotals.avgProgress}%</span></td>
                    <td><span className="status-badge" style={{ background: '#eff6ff', color: 'var(--mubs-blue)' }}>Overall</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="table-card mb-4">
          <div className="table-card-header">
            <h5>
              <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>person_search</span>
              Staff Performance Scores
            </h5>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => exportPDF('staff')}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                PDF
              </button>
              <button className="btn btn-sm btn-success fw-bold" onClick={() => exportExcel('staff')}>
                <span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>download</span>
                Excel
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Complete</th>
                  <th>Incomplete</th>
                  <th>Not Done</th>
                  <th>Total Reviewed</th>
                  <th>Performance</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {loadingPerf ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">No staff performance data found</td>
                  </tr>
                ) : (
                  staffRows.map((s) => {
                    const lbl = scoreLabel(s.performancePercent);
                    const style = scoreStyle(lbl);
                    return (
                      <tr key={s.staffId}>
                        <td className="fw-bold text-dark" style={{ fontSize: '.85rem' }}>{s.staffName}</td>
                        <td><span className="badge bg-success">{s.complete}</span></td>
                        <td><span className="badge bg-warning text-dark">{s.incomplete}</span></td>
                        <td><span className="badge bg-danger">{s.notDone}</span></td>
                        <td>{s.total}</td>
                        <td>
                          <div className="progress-bar-custom" style={{ width: '100px', display: 'inline-block', verticalAlign: 'middle' }}>
                            <div className="progress-bar-fill" style={{ width: `${s.performancePercent}%`, background: s.performancePercent >= 70 ? '#10b981' : s.performancePercent >= 50 ? '#ffcd00' : '#e31837' }} />
                          </div>
                          <span style={{ fontSize: '.75rem', marginLeft: '6px' }}>{s.performancePercent}%</span>
                        </td>
                        <td>
                          <span className="status-badge" style={{ background: style.bg, color: style.color }}>{lbl}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="table-card mb-4">
          <div className="table-card-header">
            <h5>
              <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>timeline</span>
              Department Performance Trends ({period})
            </h5>
          </div>
          {loadingPerf ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : !trendRows.length ? (
            <div className="text-center py-5 text-muted">No trend data found</div>
          ) : (
            <div className="p-3">
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-light-subtle">
                    <div className="small text-muted">Average Performance</div>
                    <div className="fw-bold fs-4 text-primary">{avgTrendPerformance}%</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-light-subtle">
                    <div className="small text-muted">Best Period</div>
                    <div className="fw-bold fs-6 text-success">
                      {trendRows.reduce((best, r) => (r.performancePercent > best.performancePercent ? r : best), trendRows[0]).periodLabel}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-light-subtle">
                    <div className="small text-muted">Total Periods</div>
                    <div className="fw-bold fs-4 text-dark">{trendRows.length}</div>
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', height: 420 }}>
                <ResponsiveContainer>
                  <ComposedChart data={trendRows} margin={{ top: 16, right: 28, bottom: 12, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="count"
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Submission count', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis
                      yAxisId="percent"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}%`}
                      label={{ value: 'Performance %', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'Performance %') return [`${value}%`, name];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend />
                    <ReferenceLine yAxisId="percent" y={70} stroke="#10b981" strokeDasharray="4 4" ifOverflow="extendDomain" />
                    <Bar yAxisId="count" dataKey="complete" name="Complete" stackId="status" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="count" dataKey="incomplete" name="Incomplete" stackId="status" fill="#f59e0b" />
                    <Bar yAxisId="count" dataKey="notDone" name="Not Done" stackId="status" fill="#ef4444" />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="performancePercent"
                      name="Performance %"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
