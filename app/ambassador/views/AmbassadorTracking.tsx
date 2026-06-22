'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AmbassadorCompliancePanel from '@/components/Ambassador/reports/AmbassadorCompliancePanel';
import AmbassadorResultsFrameworkPanel from '@/components/Ambassador/AmbassadorResultsFrameworkPanel';
import AmbassadorDashboard from '@/app/ambassador/views/AmbassadorDashboard';

type TrackingTab = 'dashboard' | 'compliance' | 'results';

function parseTrackingTab(value: string | null): TrackingTab {
  if (value === 'compliance' || value === 'milestones' || value === 'alerts') return 'compliance';
  if (value === 'results') return 'results';
  return 'dashboard';
}

export default function AmbassadorTracking() {
  const searchParams = useSearchParams();
  const activeTab = parseTrackingTab(searchParams.get('tab'));

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
      </div>

      {activeTab === 'dashboard' && <AmbassadorDashboard />}

      {activeTab === 'compliance' && <AmbassadorCompliancePanel />}

      {activeTab === 'results' && <AmbassadorResultsFrameworkPanel />}
    </div>
  );
}
