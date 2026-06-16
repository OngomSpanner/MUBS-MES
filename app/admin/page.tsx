import StrategicView from './views/Strategic';
import TrackingView from './views/Tracking';
import UsersView from './views/Users';
import ReportsView from './views/Reports';
import AdminDashboardView from './views/Dashboard';
import QuestionnaireView from './views/Questionnaire';

interface AdminPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminDashboard({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const pg = params?.pg || 'dashboard';

  switch (pg) {
    case 'strategic':
      return <StrategicView />;
    case 'tracking':
      return <TrackingView />;
    case 'users':
      return <UsersView />;
    case 'reports':
      return <ReportsView />;
    case 'questionnaire':
      return <QuestionnaireView />;
    case 'dashboard':
    default:
      return <AdminDashboardView />;
  }
}
