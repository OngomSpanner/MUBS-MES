import React, { Suspense } from 'react';
import Layout from '@/components/Layout';
import AmbassadorDashboard from './views/AmbassadorDashboard';
import AmbassadorReports from './views/AmbassadorReports';

interface AmbassadorPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AmbassadorPage({ searchParams }: AmbassadorPageProps) {
    const params = await searchParams;
    const pg = params?.pg || 'dashboard';

    const renderContent = () => {
        switch (pg) {
            case 'reports':
                return (
                    <Suspense
                        fallback={
                            <div className="d-flex justify-content-center align-items-center p-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        }
                    >
                        <AmbassadorReports />
                    </Suspense>
                );
            case 'dashboard':
            default:
                return <AmbassadorDashboard />;
        }
    };

    return (
        <Layout>
            {renderContent()}
        </Layout>
    );
}
