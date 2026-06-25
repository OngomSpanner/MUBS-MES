import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import AmbassadorTracking from './views/AmbassadorTracking';
import AmbassadorReporting from './views/AmbassadorReporting';
import AmbassadorProposeChanges from './views/AmbassadorProposeChanges';
import { getMergedPortalFlags } from '@/lib/portal-feature-flags';
import {
  firstEnabledAmbassadorMenuPg,
  firstEnabledAmbassadorReportingTab,
  firstEnabledAmbassadorTrackingTab,
  isAmbassadorMenuEnabled,
  isAmbassadorReportingTabEnabled,
  isAmbassadorTrackingTabEnabled,
  resolveAmbassadorPgTab,
} from '@/lib/portal-features';
import { AmbassadorPortalFeatureGuard } from '@/components/PortalFeatureGuards';

interface AmbassadorPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function loadingFallback() {
    return (
        <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );
}

function resolvePage(searchParams: { [key: string]: string | string[] | undefined }) {
    const pg = typeof searchParams.pg === 'string' ? searchParams.pg : 'dashboard';
    const tab = typeof searchParams.tab === 'string' ? searchParams.tab : undefined;

    switch (pg) {
        case 'tracking':
            return (
                <Suspense fallback={loadingFallback()}>
                    <AmbassadorTracking />
                </Suspense>
            );
        case 'reporting':
            return (
                <Suspense fallback={loadingFallback()}>
                    <AmbassadorReporting />
                </Suspense>
            );
        case 'propose-changes':
            return <AmbassadorProposeChanges />;
        case 'reports':
            if (tab === 'compliance' || !tab) {
                return (
                    <Suspense fallback={loadingFallback()}>
                        <AmbassadorTracking />
                    </Suspense>
                );
            }
            return (
                <Suspense fallback={loadingFallback()}>
                    <AmbassadorReporting />
                </Suspense>
            );
        default:
            return (
                <Suspense fallback={loadingFallback()}>
                    <AmbassadorTracking />
                </Suspense>
            );
    }
}

export default async function AmbassadorPage({ searchParams }: AmbassadorPageProps) {
    const params = await searchParams;
    const rawPg = typeof params.pg === 'string' ? params.pg : 'dashboard';
    const rawTab = typeof params.tab === 'string' ? params.tab : undefined;
    const pg = rawPg === 'dashboard' ? 'tracking' : rawPg;

    const flags = await getMergedPortalFlags();

    if (!isAmbassadorMenuEnabled(flags, pg)) {
        const target = firstEnabledAmbassadorMenuPg(flags);
        const qs = new URLSearchParams({ pg: target });
        if (target === 'tracking') qs.set('tab', firstEnabledAmbassadorTrackingTab(flags));
        if (target === 'reporting') qs.set('tab', firstEnabledAmbassadorReportingTab(flags));
        redirect(`/ambassador?${qs.toString()}`);
    }

    const resolved = resolveAmbassadorPgTab(flags, pg, rawTab);
    if (resolved.pg !== pg || (resolved.tab && resolved.tab !== rawTab)) {
        const qs = new URLSearchParams({ pg: resolved.pg });
        if (resolved.tab) qs.set('tab', resolved.tab);
        redirect(`/ambassador?${qs.toString()}`);
    }

    if (pg === 'tracking' && rawTab) {
        const normalized = rawTab === 'milestones' || rawTab === 'alerts' ? 'compliance' : rawTab;
        if (!isAmbassadorTrackingTabEnabled(flags, normalized)) {
            redirect(`/ambassador?pg=tracking&tab=${firstEnabledAmbassadorTrackingTab(flags)}`);
        }
    }

    if (pg === 'reporting' && rawTab && !isAmbassadorReportingTabEnabled(flags, rawTab)) {
        redirect(`/ambassador?pg=reporting&tab=${firstEnabledAmbassadorReportingTab(flags)}`);
    }

    return (
        <Layout>
            <AmbassadorPortalFeatureGuard />
            {resolvePage(params)}
        </Layout>
    );
}
