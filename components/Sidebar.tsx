"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from './Icon';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen, onLogoutClick }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentKey = (pathname.startsWith('/admin') || pathname.startsWith('/department-head') || pathname.startsWith('/ambassador'))
    ? (searchParams.get('pg') || (pathname.startsWith('/ambassador') ? 'dashboard' : 'dashboard'))
    : (pathname.substring(1) || 'dashboard');

  const adminMenuItems = [
    { key: 'dashboard', href: '/admin?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'strategic', href: '/admin?pg=strategic', icon: 'track_changes', label: 'Standard and Activities' },
    { key: 'tracking', href: '/admin?pg=tracking', icon: 'monitoring', label: 'Activity Tracking' },
    { key: 'users', href: '/admin?pg=users', icon: 'manage_accounts', label: 'User & Role Mgmt' },
    { key: 'reports', href: '/admin?pg=reports', icon: 'bar_chart', label: 'Reports & Monitoring' },
  ];


  const departmentHeadMenuItems = [
    { key: 'dashboard', href: '/department-head?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'activities', href: '/department-head?pg=activities', icon: 'track_changes', label: 'Strategic Activities' },
    { key: 'departmental-activities', href: '/department-head?pg=departmental-activities', icon: 'apartment', label: 'Departmental Activities' },
    { key: 'tasks', href: '/department-head?pg=tasks', icon: 'checklist', label: 'Processes' },
    { key: 'staff', href: '/department-head?pg=staff', icon: 'group', label: 'Staff & Warnings' },
    { key: 'evaluations', href: '/department-head?pg=evaluations', icon: 'fact_check', label: 'Submissions & reviews' },
  ];
  
  const ambassadorMenuItems = [
    { key: 'dashboard', href: '/ambassador', icon: 'dashboard', label: 'Faculty Dashboard' },
    { key: 'reports', href: '/ambassador?pg=reports', icon: 'bar_chart', label: 'Faculty Reports' },
  ];

  const staffMenuItems = [
    { key: 'dashboard', href: '/staff?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'tasks', href: '/staff?pg=tasks', icon: 'checklist', label: 'Tasks' },
    { key: 'notifications', href: '/staff?pg=notifications', icon: 'notifications_active', label: 'Notifications & Deadlines' },
    { key: 'submissions', href: '/staff?pg=submissions', icon: 'history', label: 'Submissions & Feedback' },
  ];


  let menuItems = adminMenuItems; // Default to admin

  if (pathname.startsWith('/department-head')) {
    menuItems = departmentHeadMenuItems;
  } else if (pathname.startsWith('/staff')) {
    menuItems = staffMenuItems;
  } else if (pathname.startsWith('/ambassador')) {
    menuItems = ambassadorMenuItems;
  }

  const isActive = (key: string) => currentKey === key;

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <div className="sidebar-brand d-flex align-items-center gap-3">
          <div className="logo-box">
            <img
              src="logo.png"
              alt="MUBS"
            />
          </div>
          <div>
            <div className="brand-title text-white">MUBS</div>
            <div className="brand-sub">M&E SYSTEM</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item: any) => (
            <Link
              href={item.href}
              key={item.key}
              className={`sidebar-link ${isActive(item.key) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} className="ms-icon" />
              {item.label}
              {item.badge && (
                <span className="ms-auto" style={{
                  background: item.badgeColor,
                  fontSize: '.62rem',
                  fontWeight: 800,
                  padding: '.1rem .45rem',
                  borderRadius: '99px',
                  color: item.badgeTextColor
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          <a
            className="sidebar-link"
            href="#"
            style={{ color: '#fca5a5' }}
            onClick={(e) => { e.preventDefault(); onLogoutClick(); }}
          >
            <Icon name="logout" className="ms-icon" /> Logout
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="help-avatar">
                <Icon name="support_agent" className="ms-icon" />
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>Need Help?</span>
            </div>
            <p style={{ fontSize: '.7rem', color: '#93c5fd', margin: 0 }}>
              Contact IT support or check the admin guide.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay d-lg-none"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}