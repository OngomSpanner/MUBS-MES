import React from 'react';
import { redirect } from 'next/navigation';
import Layout from '@/components/Layout';
import DepartmentHeadDashboard from './views/DepartmentHeadDashboard';
import DepartmentStrategicActivities from './views/DepartmentStrategicActivities';
import DepartmentalActivities from './views/DepartmentalActivities';
import DepartmentTasks from './views/DepartmentTasks';
import DepartmentStaff from './views/DepartmentStaff';
import DepartmentEvaluations from './views/DepartmentEvaluations';
import DepartmentReports from './views/DepartmentReports';
import HodSdsView from './views/HodSds';
import PortalNotifications from '@/components/PortalNotifications';
import { getMergedPortalFlags } from '@/lib/portal-feature-flags';
import {
  firstEnabledHodEvaluationTab,
  firstEnabledHodMenuPg,
  isHodEvaluationTabEnabled,
  isHodMenuEnabled,
} from '@/lib/portal-features';
import { HodPortalFeatureGuard } from '@/components/PortalFeatureGuards';

interface DepartmentHeadPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepartmentHeadPage({ searchParams }: DepartmentHeadPageProps) {
    const params = await searchParams;
    const pg = (typeof params?.pg === 'string' ? params.pg : 'dashboard') || 'dashboard';
    const activityParam = params?.activity as string | undefined;
    const assigneeParam = params?.assignee as string | undefined;
    const tabParam = typeof params?.tab === 'string' ? params.tab : undefined;

    const flags = await getMergedPortalFlags();

    if (pg === 'teaching-data') {
        if (isHodMenuEnabled(flags, 'evaluations') && isHodEvaluationTabEnabled(flags, 'teaching')) {
            redirect('/department-head?pg=evaluations&tab=teaching');
        }
    }
    if (pg === 'change-requests') {
        if (isHodMenuEnabled(flags, 'evaluations') && isHodEvaluationTabEnabled(flags, 'proposals')) {
            redirect('/department-head?pg=evaluations&tab=proposals');
        }
    }

    if (!isHodMenuEnabled(flags, pg)) {
        redirect(`/department-head?pg=${firstEnabledHodMenuPg(flags)}`);
    }

    if (pg === 'evaluations' && tabParam && !isHodEvaluationTabEnabled(flags, tabParam)) {
        redirect(`/department-head?pg=evaluations&tab=${firstEnabledHodEvaluationTab(flags)}`);
    }

    const renderContent = () => {
        switch (pg) {
            case 'sds':
                return <HodSdsView />;
            case 'activities':
                return <DepartmentStrategicActivities />;
            case 'departmental-activities':
                return <DepartmentalActivities />;
            case 'tasks':
                return <DepartmentTasks initialActivity={activityParam} initialAssignee={assigneeParam} />;
            case 'staff':
                return <DepartmentStaff />;
            case 'evaluations':
                return <DepartmentEvaluations />;
            case 'reports':
                return <DepartmentReports />;
            case 'notifications':
                return <PortalNotifications />;
            case 'dashboard':
            default:
                return <DepartmentHeadDashboard />;
        }
    };

    return (
        <Layout>
            <HodPortalFeatureGuard />
            {renderContent()}
        </Layout>
    );
}
