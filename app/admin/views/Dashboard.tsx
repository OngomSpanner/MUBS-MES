"use client";

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import CreateActivityModal from '@/components/Modals/CreateActivityModal';
import axios from 'axios';
import Link from 'next/link';
import { 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardStats {
  totalActivities: number;
  overallProgress: number;
  completedActivities: number;
  onTrackActivities: number;
  inProgressActivities: number;
  pendingProposals: number;
  delayedActivities: number;
  ambassadorAssignments?: number;
  ambassadorNotStarted?: number;
  ambassadorInProgress?: number;
  ambassadorAwaitingHod?: number;
  ambassadorApproved?: number;
  ambassadorFillRatePct?: number;
  ambassadorHodPendingDays?: number;
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


export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    overallProgress: 0,
    completedActivities: 0,
    onTrackActivities: 0,
    inProgressActivities: 0,
    pendingProposals: 0,
    delayedActivities: 0
  });
  const [departmentPerformance, setUnitPerformance] = useState<DepartmentPerformance[]>([]);
  const [, setRecentActivities] = useState<RecentActivity[]>([]);
  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);

  async function fetchDashboardData() {
    try {
      const response = await axios.get('/api/dashboard/stats');
      setStats(response.data.stats);
      const perf = Array.isArray(response.data.departmentPerformance)
        ? response.data.departmentPerformance
        : [];
      perf.sort(
        (a: { progress?: number }, b: { progress?: number }) =>
          Number(b?.progress ?? 0) - Number(a?.progress ?? 0)
      );
      setUnitPerformance(perf);
      setRecentActivities(response.data.recentActivities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  return (
    <Layout>
      {/* Hero banner */}
      <div className="p-4 mb-4 rounded-3" style={{ background: 'linear-gradient(135deg, #1e40af 0%, var(--mubs-navy) 100%)', border: '1px solid rgba(147, 197, 253, 0.2)' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="material-symbols-outlined" style={{ color: '#93c5fd', fontSize: '28px' }}>admin_panel_settings</span>
              <div>
                <div className="fw-black text-white" style={{ fontSize: '1.1rem' }}>Admin Dashboard</div>
                <div style={{ fontSize: '.75rem', color: '#bfdbfe' }}>System overview and management</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            icon="pending_actions"
            label="In Progress"
            value={stats.inProgressActivities}
            badge="Active"
            badgeIcon="sync"
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

      {(stats.ambassadorAssignments ?? 0) > 0 ? (
        <>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h6 className="fw-bold mb-0">Ambassador questionnaire reporting</h6>
              <p className="text-muted small mb-0">Track who has started, who is waiting on HOD approval, and overall fill rate.</p>
            </div>
            <Link href="/admin?pg=ambassador-reports" className="btn btn-sm btn-outline-primary">
              Open Ambassador Reports
            </Link>
          </div>
          <div className="row g-4 mb-4">
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=assignments&filter=not_started" className="text-decoration-none">
                <StatCard label="Not started" value={stats.ambassadorNotStarted ?? 0} color="red" />
              </Link>
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=assignments&filter=in_progress" className="text-decoration-none">
                <StatCard label="In progress" value={stats.ambassadorInProgress ?? 0} color="yellow" />
              </Link>
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=aging&filter=awaiting_hod" className="text-decoration-none">
                <StatCard label="Awaiting HOD" value={stats.ambassadorAwaitingHod ?? 0} color="blue" />
              </Link>
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=assignments&category=completed" className="text-decoration-none">
                <StatCard label="Approved" value={stats.ambassadorApproved ?? 0} color="green" />
              </Link>
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=overview" className="text-decoration-none">
                <StatCard label="Fill rate" value={`${stats.ambassadorFillRatePct ?? 0}%`} color="green" />
              </Link>
            </div>
            <div className="col-12 col-sm-6 col-xl-2">
              <Link href="/admin?pg=ambassador-reports&section=aging" className="text-decoration-none">
                <StatCard
                  label="Avg HOD wait"
                  value={(stats.ambassadorHodPendingDays ?? 0) > 0 ? `${stats.ambassadorHodPendingDays}d` : '—'}
                  color="yellow"
                />
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {/* Quick Actions (Staff-style) */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <button
            type="button"
            className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100 w-100 text-start"
            style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            onClick={() => setShowCreateActivityModal(true)}
          >
            <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 86, 150, 0.1)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)', fontSize: '22px' }}>add_task</span>
            </div>
            <div className="min-w-0">
              <div className="fw-black text-dark text-truncate" style={{ fontSize: '.95rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>Create activity</div>
              <div className="text-muted small text-truncate" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>Add a strategic plan activity</div>
            </div>
          </button>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <Link href="/admin?pg=users" className="text-decoration-none h-100">
            <div
              className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
              style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            >
              <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)' }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '22px' }}>manage_accounts</span>
              </div>
              <div className="min-w-0">
                <div className="fw-black text-dark text-truncate" style={{ fontSize: '.95rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>Users</div>
                <div className="text-muted small text-truncate" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>Manage roles & access</div>
              </div>
            </div>
          </Link>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <Link href="/admin?pg=ambassador-reports" className="text-decoration-none h-100">
            <div
              className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
              style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            >
              <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124, 58, 237, 0.1)' }}>
                <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '22px' }}>monitoring</span>
              </div>
              <div className="min-w-0">
                <div className="fw-black text-dark text-truncate" style={{ fontSize: '.95rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>Ambassador Reports</div>
                <div className="text-muted small text-truncate" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>Progress & HOD approvals</div>
              </div>
            </div>
          </Link>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <Link href="/admin?pg=reports" className="text-decoration-none h-100">
            <div
              className="quick-action-card p-3 d-flex align-items-center gap-2 gap-sm-3 bg-white border rounded-4 shadow-sm h-100"
              style={{ transition: 'all 0.2s', cursor: 'pointer', minHeight: '92px' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            >
              <div className="icon-box d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.12)' }}>
                <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '22px' }}>bar_chart</span>
              </div>
              <div className="min-w-0">
                <div className="fw-black text-dark text-truncate" style={{ fontSize: '.95rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>Reports</div>
                <div className="text-muted small text-truncate" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>Dashboards and exports</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div className="row g-4">
        {/* Important card: Strategic plan performance by faculty/office */}
        <div className="col-12 col-lg-8">
          <div className="table-card p-0 h-100">
            <div className="table-card-header">
              <h5>
                <span className="material-symbols-outlined me-2" style={{ color: '#3b82f6' }}>
                  corporate_fare
                </span>
                Unit Performance
              </h5>
              <div className="d-flex align-items-center gap-2">
              <Link href="/admin?pg=reports" className="btn btn-sm btn-outline-secondary">View all</Link>
              </div>
            </div>
            <div className="p-4" style={{ height: '320px', overflowY: 'auto' }}>
              {departmentPerformance.slice(0, 8).map((department, index) => (
                <div className="department-bar-row" key={index}>
                  <span className="department-bar-label">{department.name}</span>
                  <div className="department-bar-track">
                    <div
                      className="department-bar-fill"
                      style={{
                        width: `${department.progress}%`,
                        background: department.progress >= 70 ? '#005696' :
                          department.progress >= 50 ? '#ffcd00' : '#e31837'
                      }}
                    />
                  </div>
                  <span className="department-bar-pct">{department.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="table-card p-0 h-100">
            <div className="table-card-header">
              <h5>
                <span className="material-symbols-outlined me-2" style={{ color: '#f59e0b' }}>
                  donut_large
                </span>
                Activity Status
              </h5>
              <Link href="/admin?pg=reports" className="btn btn-sm btn-outline-secondary">View</Link>
            </div>
            <div className="p-4 d-flex flex-column align-items-center justify-content-center" style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: stats.completedActivities, color: '#10b981' },
                      { name: 'In Progress', value: stats.onTrackActivities, color: '#3b82f6' },
                      { name: 'Not Started', value: Math.max(0, stats.totalActivities - stats.completedActivities - stats.onTrackActivities - stats.delayedActivities), color: '#64748b' },
                      { name: 'Overdue', value: stats.delayedActivities, color: '#ef4444' }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: 'Completed', value: stats.completedActivities, color: '#10b981' },
                      { name: 'In Progress', value: stats.onTrackActivities, color: '#3b82f6' },
                      { name: 'Not Started', value: Math.max(0, stats.totalActivities - stats.completedActivities - stats.onTrackActivities - stats.delayedActivities), color: '#64748b' },
                      { name: 'Overdue', value: stats.delayedActivities, color: '#ef4444' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-2">
                {[
                  { label: 'Completed', color: '#10b981' },
                  { label: 'In Progress', color: '#3b82f6' },
                  { label: 'Not Started', color: '#64748b' },
                  { label: 'Overdue', color: '#ef4444' }
                ].map((item, i) => (
                  <div key={i} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CreateActivityModal
        show={showCreateActivityModal}
        onHide={() => setShowCreateActivityModal(false)}
        onActivityCreated={fetchDashboardData}
        mode="create"
      />
    </Layout>
  );
}