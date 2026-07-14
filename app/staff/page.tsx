"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import StaffDashboard from './views/StaffDashboard';
import StaffTasks from './views/StaffTasks';
import StaffUpdates from './views/StaffUpdates';
import StaffSubmissions from './views/StaffSubmissions';
import StaffProcessTasks from './views/StaffProcessTasks';
import StaffAcademicTeaching from './views/StaffAcademicTeaching';
import StaffSdsView from './views/StaffSds';

function StaffAcademicTeachingGate() {
    const router = useRouter();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        void fetch('/api/staff/profile')
            .then((r) => (r.ok ? r.json() : { isAcademicStaff: false }))
            .then((data: { isAcademicStaff?: boolean }) => {
                if (cancelled) return;
                if (data.isAcademicStaff) setAllowed(true);
                else router.replace('/staff?pg=dashboard');
            })
            .catch(() => {
                if (!cancelled) router.replace('/staff?pg=dashboard');
            });
        return () => {
            cancelled = true;
        };
    }, [router]);

    if (allowed !== true) {
        return <div className="text-muted small py-4">Loading…</div>;
    }
    return <StaffAcademicTeaching />;
}

function StaffContent() {
    const searchParams = useSearchParams();
    const pg = searchParams.get('pg') || 'dashboard';

    switch (pg) {
        case 'dashboard':
            return <StaffDashboard />;
        case 'sds':
            return <StaffSdsView />;
        case 'tasks':
            return <StaffTasks />;
        case 'deadlines':
        case 'notifications':
            return <StaffUpdates />;
        case 'submissions':
            return <StaffSubmissions />;
        case 'process-steps':
        case 'process-tasks':
            return <StaffProcessTasks />;
        case 'academic-teaching':
            return <StaffAcademicTeachingGate />;
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
