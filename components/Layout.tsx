"use client";

import { useState, Suspense } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { PortalFeaturesProvider } from './PortalFeaturesProvider';
import { usePathname, useSearchParams } from 'next/navigation';

function LayoutContent({ children, sidebarOpen, setSidebarOpen }: any) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getPageKey = () => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/ambassador') || pathname.startsWith('/department-head') || pathname.startsWith('/staff')) {
      return searchParams.get('pg') || 'dashboard';
    }
    const trimmed = pathname.substring(1);
    return trimmed || 'dashboard';
  };

  const getPageTitle = () => {
    const key = getPageKey();
    if (key === 'notifications') {
      return pathname.startsWith('/staff') ? 'Notifications & Deadlines' : 'Notifications';
    }
    if (pathname.startsWith('/ambassador')) {
      if (key === 'propose-changes') return 'Propose Changes';
      if (key === 'tracking' || key === 'dashboard') {
        const tab = searchParams.get('tab') || 'dashboard';
        if (tab === 'dashboard') return 'Dept. / Unit Dashboard';
        if (tab === 'results') return 'Results Framework';
        if (tab === 'compliance' || tab === 'milestones' || tab === 'alerts') return 'Dept. / Unit Activity Progress';
        return 'Tracking';
      }
      if (key === 'reporting' || key === 'reports') {
        const ambassadorReportTitles: Record<string, string> = {
          compliance: 'Dept. / Unit Activity Progress',
          'data-collection': 'Performance Indicators',
          'staff-profiles': 'Staff Profiles',
          recruitment: 'Staff Recruitment',
          benefits: 'Staff Benefits',
          'workforce-assessments': 'Workforce Assessments',
          'employment-skill-status': 'Skills Assessments',
          'programme-enrollment': 'Programme Enrollment',
          'course-unit-enrollment': 'Course Unit Enrollment',
        };
        const tab = searchParams.get('tab') || (key === 'reports' ? 'compliance' : 'recruitment');
        if (tab === 'compliance') return 'Dept. / Unit Activity Progress';
        return ambassadorReportTitles[tab] ?? 'Unit Reporting';
      }
    }
    if (key === 'strategic' && pathname.startsWith('/admin')) {
      return 'Standard and Activities';
    }
    const pageTitles: { [key: string]: string } = {
      'dashboard': 'Dashboard Overview',
      'strategic': 'Strategic Activities',
      'standards': 'Standards & Objectives',
      'change-requests': 'Ambassador Proposals',
      'users': 'User Management',
      'reports': 'Reports & Analytics',
      'ambassador-reports': 'Ambassador Reports',
      'questionnaire': 'Questionnaire Templates',
      'settings': 'Settings',
      'reporting': 'Unit Reporting',
      'propose-changes': 'Propose Changes',

      // HOD specific
      'activities': 'Assigned Activities',
      'teaching-data': 'Lecturer teaching data',

      // Both HOD and Staff specific shared keys
      'tasks': 'Task Management',
      'staff': 'Staff Development & Training',
      'submissions': 'Submissions & Feedback Tracking',
      'evaluations': 'Evaluations',

      // Staff specific
      'deadlines': 'Notifications & Deadlines',
      'academic-teaching': 'Lecturer teaching data',
    };
    return pageTitles[key] || 'Dashboard';
  };

  return (
    <>
      <Topbar
        pageTitle={getPageTitle()}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="content-area">
        {children}
      </div>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout API call failed:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/';
  };


  return (
    <PortalFeaturesProvider>
      <div className="app-shell">
        <Suspense fallback={<div className="p-4 flex-fill d-flex align-items-center justify-content-center"><div className="spinner-border text-primary" role="status"></div></div>}>
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onLogoutClick={handleLogout}
          />
          <div className="main-area">
            <LayoutContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
              {children}
            </LayoutContent>
          </div>
        </Suspense>
      </div>
    </PortalFeaturesProvider>
  );
}