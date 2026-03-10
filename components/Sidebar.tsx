"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen, onLogoutClick }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentKey = (pathname.startsWith('/admin') || pathname.startsWith('/principal') || pathname.startsWith('/department-head'))
    ? (searchParams.get('pg') || (pathname.startsWith('/principal') ? 'executive' : 'dashboard'))
    : (pathname.substring(1) || 'dashboard');

  const adminMenuItems = [
    { key: 'dashboard', href: '/admin?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'strategic', href: '/admin?pg=strategic', icon: 'track_changes', label: 'Strategic Activities' },
    { key: 'committee', href: '/admin?pg=committee', icon: 'groups', label: 'Committee Activities' },
    { key: 'tracking', href: '/admin?pg=tracking', icon: 'monitoring', label: 'Activity Tracking' },
    { key: 'users', href: '/admin?pg=users', icon: 'manage_accounts', label: 'User & Role Mgmt' },
    { key: 'reports', href: '/admin?pg=reports', icon: 'bar_chart', label: 'Reports & Monitoring' },
  ];

  const principalMenuItems = [
    { key: 'executive', href: '/principal?pg=executive', icon: 'space_dashboard', label: 'Executive Overview' },
    { key: 'strategic', href: '/principal?pg=strategic', icon: 'track_changes', label: 'Strategic Summary' },
    { key: 'analytics', href: '/principal?pg=analytics', icon: 'insert_chart', label: 'Performance Analytics' },
    { key: 'reports', href: '/principal?pg=reports', icon: 'description', label: 'Reports' },
  ];

  const departmentHeadMenuItems = [
    { key: 'dashboard', href: '/department-head?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'activities', href: '/department-head?pg=activities', icon: 'track_changes', label: 'Strategic Activities' },
    { key: 'tasks', href: '/department-head?pg=tasks', icon: 'task_alt', label: 'Tasks', badge: '3', badgeType: 'warning' },
    { key: 'staff', href: '/department-head?pg=staff', icon: 'group', label: 'Staff & Warnings', badge: '2', badgeType: 'danger' },
    { key: 'submissions', href: '/department-head?pg=submissions', icon: 'inbox', label: 'Submissions' },
    { key: 'evaluations', href: '/department-head?pg=evaluations', icon: 'rate_review', label: 'Evaluations' },
  ];

  const staffMenuItems = [
    { key: 'dashboard', href: '/staff?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'tasks', href: '/staff?pg=tasks', icon: 'task_alt', label: 'My Tasks' },
    { key: 'deadlines', href: '/staff?pg=deadlines', icon: 'schedule', label: 'Deadlines' },
    { key: 'notifications', href: '/staff?pg=notifications', icon: 'notifications', label: 'Notifications' },
    { key: 'submit', href: '/staff?pg=submit', icon: 'upload_file', label: 'Submit Report' },
    { key: 'submissions', href: '/staff?pg=submissions', icon: 'history', label: 'My Submissions' },
    { key: 'feedback', href: '/staff?pg=feedback', icon: 'rate_review', label: 'Feedback & Scores' },
  ];

  const commMenuItems = [
    { key: 'dashboard', href: '/comm?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'propose', href: '/comm?pg=propose', icon: 'post_add', label: 'New Proposal' },
    { key: 'my-proposals', href: '/comm?pg=my-proposals', icon: 'list_alt', label: 'All Proposals' },
    { key: 'pending', href: '/comm?pg=pending', icon: 'pending_actions', label: 'Pending Review' },
    { key: 'approved', href: '/comm?pg=approved', icon: 'check_circle', label: 'Approved' },
    { key: 'rejected', href: '/comm?pg=rejected', icon: 'cancel', label: 'Rejected' },
    { key: 'notifications', href: '/comm?pg=notifications', icon: 'notifications', label: 'Notifications' },
  ];

  let menuItems = adminMenuItems; // Default to admin

  if (pathname.startsWith('/principal')) {
    menuItems = principalMenuItems;
  } else if (pathname.startsWith('/department-head')) {
    menuItems = departmentHeadMenuItems;
  } else if (pathname.startsWith('/staff')) {
    menuItems = staffMenuItems;
  } else if (pathname.startsWith('/comm')) {
    menuItems = commMenuItems;
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
            <div className="brand-title text-white">MUBS Strategy Plan </div>
            <div className="brand-sub">System</div>
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
              <span className="material-symbols-outlined">{item.icon}</span>
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
            <span className="material-symbols-outlined">logout</span> Logout
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="help-avatar">
                <span className="material-symbols-outlined">support_agent</span>
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