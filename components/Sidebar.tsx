'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

type MenuItem = {
  key: string;
  href: string;
  icon: string;
  label: string;
};

export default function Sidebar({ sidebarOpen, setSidebarOpen, onLogoutClick }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ambassadorPg = pathname.startsWith('/ambassador') ? searchParams.get('pg') : null;
  const ambassadorTab = searchParams.get('tab');

  const ambassadorCurrentKey = useMemo(() => {
    if (!pathname.startsWith('/ambassador')) return null;
    const pg = ambassadorPg || 'dashboard';
    if (pg === 'propose-changes') return 'propose-changes';
    if (pg === 'reporting' || (pg === 'reports' && ambassadorTab && ambassadorTab !== 'compliance')) {
      return 'reporting';
    }
    return 'tracking';
  }, [pathname, ambassadorPg, ambassadorTab]);

  const currentKey =
    pathname.startsWith('/admin') || pathname.startsWith('/department-head') || pathname.startsWith('/staff')
      ? searchParams.get('pg') || 'dashboard'
      : pathname.startsWith('/ambassador')
        ? ambassadorCurrentKey || 'dashboard'
        : pathname.substring(1) || 'dashboard';

  const adminMenuItems = [
    { key: 'dashboard', href: '/admin?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'strategic', href: '/admin?pg=strategic', icon: 'track_changes', label: 'Standard and Activities' },
    { key: 'questionnaire', href: '/admin?pg=questionnaire', icon: 'help_outline', label: 'Questionnaire' },
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
    { key: 'teaching-data', href: '/department-head?pg=teaching-data', icon: 'school', label: 'Academic Teaching Data' },
    { key: 'change-requests', href: '/department-head?pg=change-requests', icon: 'rate_review', label: 'Ambassador Proposals' },
    { key: 'reports', href: '/department-head?pg=reports', icon: 'analytics', label: 'Performance & Reports' },
  ];

  const ambassadorMenuItems: MenuItem[] = [
    {
      key: 'tracking',
      href: '/ambassador?pg=tracking&tab=dashboard',
      icon: 'monitoring',
      label: 'Tracking',
    },
    {
      key: 'reporting',
      href: '/ambassador?pg=reporting&tab=data-collection',
      icon: 'bar_chart',
      label: 'Reporting',
    },
    {
      key: 'propose-changes',
      href: '/ambassador?pg=propose-changes',
      icon: 'edit_note',
      label: 'Propose Changes',
    },
  ];

  const staffMenuItems = [
    { key: 'dashboard', href: '/staff?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'tasks', href: '/staff?pg=tasks', icon: 'checklist', label: 'Tasks' },
    { key: 'notifications', href: '/staff?pg=notifications', icon: 'notifications_active', label: 'Notifications & Deadlines' },
    { key: 'submissions', href: '/staff?pg=submissions', icon: 'history', label: 'Submissions & Feedback' },
    { key: 'academic-teaching', href: '/staff?pg=academic-teaching', icon: 'school', label: 'Academic Teaching' },
  ];

  const isAmbassador = pathname.startsWith('/ambassador');
  const isDepartmentHead = pathname.startsWith('/department-head');
  const isStaff = pathname.startsWith('/staff');
  const [isAcademicStaff, setIsAcademicStaff] = useState<boolean | null>(null);
  const [hasAcademicTeachingScope, setHasAcademicTeachingScope] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isStaff) {
      setIsAcademicStaff(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/staff/profile')
      .then((r) => (r.ok ? r.json() : { isAcademicStaff: false }))
      .then((data: { isAcademicStaff?: boolean }) => {
        if (!cancelled) setIsAcademicStaff(Boolean(data.isAcademicStaff));
      })
      .catch(() => {
        if (!cancelled) setIsAcademicStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  useEffect(() => {
    if (!isDepartmentHead) {
      setHasAcademicTeachingScope(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/department-head/profile')
      .then((r) => (r.ok ? r.json() : { hasAcademicTeachingScope: false }))
      .then((data: { hasAcademicTeachingScope?: boolean }) => {
        if (!cancelled) setHasAcademicTeachingScope(Boolean(data.hasAcademicTeachingScope));
      })
      .catch(() => {
        if (!cancelled) setHasAcademicTeachingScope(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDepartmentHead]);

  const visibleStaffMenuItems = useMemo(
    () =>
      staffMenuItems.filter(
        (item) => item.key !== 'academic-teaching' || isAcademicStaff === true
      ),
    [isAcademicStaff]
  );

  const visibleDepartmentHeadMenuItems = useMemo(
    () =>
      departmentHeadMenuItems.filter(
        (item) => item.key !== 'teaching-data' || hasAcademicTeachingScope === true
      ),
    [hasAcademicTeachingScope]
  );

  const isActive = (key: string) => currentKey === key;

  const renderFlatMenu = (items: MenuItem[]) =>
    items.map((item) => (
      <Link
        href={item.href}
        key={item.key}
        className={`sidebar-link ${isActive(item.key) ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      >
        <span className="material-symbols-outlined ms-icon">{item.icon}</span>
        {item.label}
      </Link>
    ));

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
          {isAmbassador
            ? renderFlatMenu(ambassadorMenuItems)
            : isDepartmentHead
              ? renderFlatMenu(visibleDepartmentHeadMenuItems)
              : isStaff
                ? renderFlatMenu(visibleStaffMenuItems)
                : renderFlatMenu(adminMenuItems)}

          <a
            className="sidebar-link"
            href="#"
            style={{ color: '#fca5a5' }}
            onClick={(e) => {
              e.preventDefault();
              onLogoutClick();
            }}
          >
            <span className="material-symbols-outlined ms-icon">logout</span> Logout
          </a>
        </nav>

        <div className="sidebar-footer">
          <a
            href="mailto:mubsme@mubs.ac.ug?subject=MUBS%20M%26E%20System%20Support"
            className="help-card"
            title="Email IT support"
          >
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="help-avatar">
                <span className="material-symbols-outlined ms-icon">support_agent</span>
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>Need Help?</span>
            </div>
            <p style={{ fontSize: '.7rem', color: '#93c5fd', margin: 0 }}>
              Email{' '}
              <span style={{ color: '#fff', fontWeight: 600 }}>mubsme@mubs.ac.ug</span>
              {' '}or use live chat (bottom-right).
            </p>
          </a>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="sidebar-overlay d-lg-none" onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
}
