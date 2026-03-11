import React from 'react';
import Layout from '@/components/Layout';
import DepartmentHeadDashboard from './views/DepartmentHeadDashboard';
import DepartmentStrategicActivities from './views/DepartmentStrategicActivities';
import DepartmentTasks from './views/DepartmentTasks';
import DepartmentStaff from './views/DepartmentStaff';
import DepartmentSubmissions from './views/DepartmentSubmissions';
import DepartmentEvaluations from './views/DepartmentEvaluations';

interface DepartmentHeadPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepartmentHeadPage({ searchParams }: DepartmentHeadPageProps) {
    const params = await searchParams;
    const pg = params?.pg || 'dashboard';
    const activityParam = params?.activity as string | undefined;
    const assigneeParam = params?.assignee as string | undefined;

    const renderContent = () => {
        switch (pg) {
            case 'activities':
                return <DepartmentStrategicActivities />;
            case 'tasks':
                return <DepartmentTasks initialActivity={activityParam} initialAssignee={assigneeParam} />;
            case 'staff':
                return <DepartmentStaff />;
            case 'submissions':
                return <DepartmentSubmissions />;
            case 'evaluations':
                return <DepartmentEvaluations />;
            case 'dashboard':
            default:
                return <DepartmentHeadDashboard />;
        }
    };

    return (
        <Layout>
            {renderContent()}
        </Layout>
    );
}
