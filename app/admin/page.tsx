import StrategicView from './views/Strategic';
import UsersView from './views/Users';
import ReportsView from './views/Reports';
import AdminDashboardView from './views/Dashboard';
import QuestionnaireView from './views/Questionnaire';
import { redirect } from 'next/navigation';

interface AdminPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminDashboard({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const pg = params?.pg || 'dashboard';

  switch (pg) {
    case 'tracking':
      redirect('/admin?pg=reports');
    case 'strategic':
      return <StrategicView />;
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
