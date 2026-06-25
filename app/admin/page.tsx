import StrategicView from './views/Strategic';
import UsersView from './views/Users';
import ReportsView from './views/Reports';
import AdminDashboardView from './views/Dashboard';
import QuestionnaireView from './views/Questionnaire';
import PortalSettingsView from './views/PortalSettings';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { canManagePortalSettings } from '@/lib/role-routing';

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
    case 'settings': {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      const decoded = token ? (verifyToken(token) as { role?: string } | null) : null;
      if (!decoded || !canManagePortalSettings(decoded.role)) {
        redirect('/admin?pg=dashboard');
      }
      return <PortalSettingsView />;
    }
    case 'dashboard':
    default:
      return <AdminDashboardView />;
  }
}
