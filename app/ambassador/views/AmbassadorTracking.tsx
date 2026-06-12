'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import AmbassadorCompliancePanel from '@/components/Ambassador/reports/AmbassadorCompliancePanel';
import AmbassadorResultsFrameworkPanel from '@/components/Ambassador/AmbassadorResultsFrameworkPanel';
import AmbassadorMilestonesPanel from '@/components/Ambassador/AmbassadorMilestonesPanel';
import AmbassadorDashboard from '@/app/ambassador/views/AmbassadorDashboard';

type TrackingTab = 'dashboard' | 'compliance' | 'alerts' | 'results' | 'milestones';

type RiskAlert = {
  id: number;
  title: string;
  department: string;
  status: string;
  progress: number;
  dueDate: string | null;
};

function parseTrackingTab(value: string | null): TrackingTab {
  if (value === 'compliance') return 'compliance';
  if (value === 'alerts') return 'alerts';
  if (value === 'results') return 'results';
  if (value === 'milestones') return 'milestones';
  return 'dashboard';
}

export default function AmbassadorTracking() {
  const searchParams = useSearchParams();
  const activeTab = parseTrackingTab(searchParams.get('tab'));

  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [managedUnitName, setManagedUnitName] = useState('');
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'alerts') return;
    setAlertsLoading(true);
    axios
      .get('/api/dashboard/ambassador')
      .then((res) => {
        setAlerts(res.data.riskAlerts ?? []);
        setManagedUnitName(res.data.managedUnitName ?? '');
      })
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, [activeTab]);

  return (
    <div className="page-section active-page">
      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link
          href="/ambassador?pg=tracking&tab=dashboard"
          className={`btn btn-sm fw-bold ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={activeTab === 'dashboard' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        >
          Dashboard
        </Link>
        <Link
          href="/ambassador?pg=tracking&tab=compliance"
          className={`btn btn-sm fw-bold ${activeTab === 'compliance' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={activeTab === 'compliance' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        >
          Activity progress
        </Link>
        <Link
          href="/ambassador?pg=tracking&tab=results"
          className={`btn btn-sm fw-bold ${activeTab === 'results' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={activeTab === 'results' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        >
          Results Framework
        </Link>
        <Link
          href="/ambassador?pg=tracking&tab=milestones"
          className={`btn btn-sm fw-bold ${activeTab === 'milestones' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={activeTab === 'milestones' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        >
          Milestones
        </Link>
        <Link
          href="/ambassador?pg=tracking&tab=alerts"
          className={`btn btn-sm fw-bold ${activeTab === 'alerts' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={activeTab === 'alerts' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        >
          Risk alerts
          {alerts.length > 0 && activeTab !== 'alerts' ? (
            <span className="badge bg-danger ms-1">{alerts.length}</span>
          ) : null}
        </Link>
      </div>

      {activeTab === 'dashboard' && <AmbassadorDashboard />}

      {activeTab === 'compliance' && <AmbassadorCompliancePanel />}

      {activeTab === 'results' && <AmbassadorResultsFrameworkPanel />}

      {activeTab === 'milestones' && <AmbassadorMilestonesPanel />}

      {activeTab === 'alerts' && (
        <div className="table-card shadow-sm border-0 bg-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div className="table-card-header">
            <h5 className="mb-0 d-flex align-items-center gap-2">
              <span className="material-symbols-outlined text-danger">crisis_alert</span>
              Area risk alerts
              {managedUnitName ? (
                <span className="text-muted fw-normal small">· {managedUnitName}</span>
              ) : null}
            </h5>
          </div>
          <div className="p-4">
            {alertsLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.4 }}>
                  check_circle
                </span>
                No active risk alerts in your managed unit.
              </div>
            ) : (
              <div className="row g-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="col-12 col-md-6">
                    <div className="border rounded-4 p-3 h-100 bg-light">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div className="fw-bold text-dark small">{alert.title}</div>
                        <span
                          className={`badge ${alert.status === 'Critical' ? 'bg-danger' : 'bg-warning text-dark'}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {alert.status}
                        </span>
                      </div>
                      <div className="text-muted small mb-1">{alert.department}</div>
                      <div className="small">
                        Progress: <strong>{alert.progress}%</strong>
                        {alert.dueDate ? (
                          <span className="text-muted ms-2">
                            Due:{' '}
                            {new Date(alert.dueDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
