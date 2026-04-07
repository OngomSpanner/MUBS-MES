"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Layout from '../../components/Layout';
import StaffDashboard from './views/StaffDashboard';
import StaffTasks from './views/StaffTasks';
import StaffUpdates from './views/StaffUpdates';
import StaffSubmissions from './views/StaffSubmissions';
import StaffFeedback from './views/StaffFeedback';
import StaffProcessTasks from './views/StaffProcessTasks';

function StaffContent() {
    const searchParams = useSearchParams();
    const pg = searchParams.get('pg') || 'dashboard';

    switch (pg) {
        case 'dashboard':
            return <StaffDashboard />;
        case 'tasks':
            return <StaffTasks />;
        case 'deadlines':
        case 'notifications':
            return <StaffUpdates />;
        case 'submissions':
            return <StaffSubmissions />;
        case 'process-steps':
            return <StaffProcessTasks />;
        default:
            return <StaffDashboard />;
    }
}

export default function StaffPage() {
    return (
        <Layout>
            <Suspense fallback={<div className="p-4">Loading Staff Dashboard...</div>}>
                <StaffContent />
            </Suspense>
        </Layout>
    );
}
