'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AmbassadorCompliancePanel from '@/components/Ambassador/reports/AmbassadorCompliancePanel';
import AmbassadorResultsFrameworkPanel from '@/components/Ambassador/AmbassadorResultsFrameworkPanel';
import AmbassadorDashboard from '@/app/ambassador/views/AmbassadorDashboard';
import { usePortalFeatures } from '@/components/PortalFeaturesProvider';
import {
  AMBASSADOR_TRACKING_TAB_FEATURE_KEYS,
  isFeatureEnabled,
} from '@/lib/portal-features';

type TrackingTab = 'dashboard' | 'compliance' | 'results';

const TRACKING_TABS: { key: TrackingTab; label: string; hrefTab: string }[] = [
  { key: 'dashboard', label: 'Dashboard', hrefTab: 'dashboard' },
  { key: 'compliance', label: 'Activity progress', hrefTab: 'compliance' },
  { key: 'results', label: 'Results Framework', hrefTab: 'results' },
];

function parseTrackingTab(value: string | null): TrackingTab {
  if (value === 'compliance' || value === 'milestones' || value === 'alerts') return 'compliance';
  if (value === 'results') return 'results';
  return 'dashboard';
}

export default function AmbassadorTracking() {
  const searchParams = useSearchParams();
  const { flags: portalFlags } = usePortalFeatures();
  const activeTab = parseTrackingTab(searchParams.get('tab'));

  const visibleTabs = useMemo(
    () =>
      TRACKING_TABS.filter((t) => {
        const featureKey = AMBASSADOR_TRACKING_TAB_FEATURE_KEYS[t.key];
        return !featureKey || isFeatureEnabled(portalFlags, featureKey);
      }),
    [portalFlags],
  );

  return (
    <div className="page-section active-page">
      <div className="d-flex flex-wrap gap-2 mb-4">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/ambassador?pg=tracking&tab=${tab.hrefTab}`}
            className={`btn btn-sm fw-bold ${activeTab === tab.key ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={activeTab === tab.key ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === 'dashboard' && isFeatureEnabled(portalFlags, AMBASSADOR_TRACKING_TAB_FEATURE_KEYS.dashboard) && (
        <AmbassadorDashboard />
      )}

      {activeTab === 'compliance' && isFeatureEnabled(portalFlags, AMBASSADOR_TRACKING_TAB_FEATURE_KEYS.compliance) && (
        <AmbassadorCompliancePanel />
      )}

      {activeTab === 'results' && isFeatureEnabled(portalFlags, AMBASSADOR_TRACKING_TAB_FEATURE_KEYS.results) && (
        <AmbassadorResultsFrameworkPanel />
      )}
    </div>
  );
}
