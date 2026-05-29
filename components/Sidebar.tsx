"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import axios from 'axios';


interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen, onLogoutClick }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ambassadorPg = pathname.startsWith('/ambassador') ? (searchParams.get('pg') || 'dashboard') : null;
  const ambassadorTab = ambassadorPg === 'reports' ? (searchParams.get('tab') || 'compliance') : null;

  const currentKey = (pathname.startsWith('/admin') || pathname.startsWith('/department-head') || pathname.startsWith('/ambassador'))
    ? (pathname.startsWith('/ambassador') && ambassadorPg === 'reports'
        ? `reports-${ambassadorTab}`
        : (searchParams.get('pg') || (pathname.startsWith('/ambassador') ? 'dashboard' : 'dashboard')))
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
    { key: 'reports', href: '/department-head?pg=reports', icon: 'analytics', label: 'Performance & Reports' },
  ];
  
  const [canManageEnrollment, setCanManageEnrollment] = useState(false);

  useEffect(() => {
    if (!pathname.startsWith('/ambassador')) return;
    axios
      .get('/api/ambassador/reports/staff-options')
      .then((res) => setCanManageEnrollment(Boolean(res.data.canManageEnrollment)))
      .catch(() => setCanManageEnrollment(false));
  }, [pathname]);

  const ambassadorMenuItems = useMemo(() => {
    const items = [
      { key: 'dashboard', href: '/ambassador', icon: 'dashboard', label: 'Faculty Dashboard' },
      { key: 'reports-compliance', href: '/ambassador?pg=reports&tab=compliance', icon: 'fact_check', label: 'Dept. Compliance Tracker' },
      { key: 'reports-staff-profiles', href: '/ambassador?pg=reports&tab=staff-profiles', icon: 'badge', label: 'Staff Profiles' },
      { key: 'reports-recruitment', href: '/ambassador?pg=reports&tab=recruitment', icon: 'person_add', label: 'Staff Recruitment' },
      { key: 'reports-benefits', href: '/ambassador?pg=reports&tab=benefits', icon: 'card_giftcard', label: 'Staff Benefits' },
      { key: 'reports-workforce-assessments', href: '/ambassador?pg=reports&tab=workforce-assessments', icon: 'groups', label: 'Workforce Assessments' },
      { key: 'reports-employment-skill-status', href: '/ambassador?pg=reports&tab=employment-skill-status', icon: 'school', label: 'Skills Assessments' },
    ];
    if (canManageEnrollment) {
      items.push(
        { key: 'reports-programme-enrollment', href: '/ambassador?pg=reports&tab=programme-enrollment', icon: 'school', label: 'Programme Enrollment' },
        { key: 'reports-course-unit-enrollment', href: '/ambassador?pg=reports&tab=course-unit-enrollment', icon: 'menu_book', label: 'Course Unit Enrollment' }
      );
    }
    return items;
  }, [canManageEnrollment]);

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
            <Image
              src="/logo.webp"
              alt="MUBS"
              width={44}
              height={44}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
              <span className="material-symbols-outlined ms-icon">{item.icon}</span>
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
            <span className="material-symbols-outlined ms-icon">logout</span> Logout
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="help-avatar">
                <span className="material-symbols-outlined ms-icon">support_agent</span>
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>Need Help?</span>
            </div>
            <p style={{ fontSize: '.7rem', color: '#93c5fd', margin: 0 }}>
              Contact IT support at mubsme@mubs.ac.ug.
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