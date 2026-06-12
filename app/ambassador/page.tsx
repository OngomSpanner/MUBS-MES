import React, { Suspense } from 'react';
import Layout from '@/components/Layout';
import AmbassadorTracking from './views/AmbassadorTracking';
import AmbassadorReporting from './views/AmbassadorReporting';
import AmbassadorProposeChanges from './views/AmbassadorProposeChanges';

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
            // Legacy URLs: compliance → tracking; other tabs → reporting
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

    return (
        <Layout>
            {resolvePage(params)}
        </Layout>
    );
}
