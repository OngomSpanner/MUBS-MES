'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePortalFeatures } from '@/components/PortalFeaturesProvider';
import {
  firstEnabledAmbassadorMenuPg,
  firstEnabledAmbassadorReportingTab,
  firstEnabledAmbassadorTrackingTab,
  isAmbassadorMenuEnabled,
  isAmbassadorReportingTabEnabled,
  isAmbassadorTrackingTabEnabled,
  isHodEvaluationTabEnabled,
  isHodMenuEnabled,
  firstEnabledHodEvaluationTab,
  firstEnabledHodMenuPg,
} from '@/lib/portal-features';

/**
 * Client-side guard when server render could not know final tab state
 * or when flags load after first paint.
 */
export function HodPortalFeatureGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { flags, loading } = usePortalFeatures();

  useEffect(() => {
    if (loading || !pathname.startsWith('/department-head')) return;

    const pg = searchParams.get('pg') || 'dashboard';
    const tab = searchParams.get('tab');

    if (!isHodMenuEnabled(flags, pg)) {
      const target = firstEnabledHodMenuPg(flags);
      if (target !== pg) {
        router.replace(`/department-head?pg=${target}`);
      }
      return;
    }

    if (pg === 'evaluations' && tab && !isHodEvaluationTabEnabled(flags, tab)) {
      const fallback = firstEnabledHodEvaluationTab(flags);
      if (fallback !== tab) {
        router.replace(`/department-head?pg=evaluations&tab=${fallback}`);
      }
    }
  }, [loading, flags, pathname, searchParams, router]);

  return null;
}

export function AmbassadorPortalFeatureGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { flags, loading } = usePortalFeatures();

  useEffect(() => {
    if (loading || !pathname.startsWith('/ambassador')) return;

    let pg = searchParams.get('pg') || 'tracking';
    if (pg === 'dashboard') pg = 'tracking';
    const tab = searchParams.get('tab');

    if (!isAmbassadorMenuEnabled(flags, pg)) {
      const target = firstEnabledAmbassadorMenuPg(flags);
      const qs = new URLSearchParams({ pg: target });
      if (target === 'tracking') qs.set('tab', firstEnabledAmbassadorTrackingTab(flags));
      if (target === 'reporting') qs.set('tab', firstEnabledAmbassadorReportingTab(flags));
      router.replace(`/ambassador?${qs.toString()}`);
      return;
    }

    if (pg === 'tracking') {
      const normalized = tab === 'milestones' || tab === 'alerts' ? 'compliance' : (tab || 'dashboard');
      if (!isAmbassadorTrackingTabEnabled(flags, normalized)) {
        const fallback = firstEnabledAmbassadorTrackingTab(flags);
        router.replace(`/ambassador?pg=tracking&tab=${fallback}`);
      }
      return;
    }

    if (pg === 'reporting') {
      const current = tab || 'data-collection';
      if (!isAmbassadorReportingTabEnabled(flags, current)) {
        const fallback = firstEnabledAmbassadorReportingTab(flags);
        router.replace(`/ambassador?pg=reporting&tab=${fallback}`);
      }
    }
  }, [loading, flags, pathname, searchParams, router]);

  return null;
}
