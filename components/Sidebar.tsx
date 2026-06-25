'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePortalFeatures } from '@/components/PortalFeaturesProvider';
import {
  AMBASSADOR_MENU_FEATURE_KEYS,
  HOD_MENU_FEATURE_KEYS,
  isFeatureEnabled,
} from '@/lib/portal-features';
import { normalizeRoleForCookie } from '@/lib/role-routing';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';

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
  featureKey?: string;
};

export default function Sidebar({ sidebarOpen, setSidebarOpen, onLogoutClick }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ambassadorPg = pathname.startsWith('/ambassador') ? searchParams.get('pg') : null;
  const ambassadorTab = searchParams.get('tab');

  const ambassadorCurrentKey = useMemo(() => {
    if (!pathname.startsWith('/ambassador')) return null;
    const pg = ambassadorPg || 'dashboard';
    if (pg === 'notifications') return 'notifications';
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

  const adminMenuItems: MenuItem[] = [
    { key: 'dashboard', href: '/admin?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'strategic', href: '/admin?pg=strategic', icon: 'track_changes', label: 'Standard and Activities' },
    { key: 'questionnaire', href: '/admin?pg=questionnaire', icon: 'help_outline', label: 'Questionnaire' },
    { key: 'reports', href: '/admin?pg=reports', icon: 'bar_chart', label: 'Reports & Monitoring' },
    { key: 'users', href: '/admin?pg=users', icon: 'manage_accounts', label: 'User & Role Mgmt' },
    { key: 'settings', href: '/admin?pg=settings', icon: 'tune', label: 'Settings' },
  ];

  const departmentHeadMenuItems: MenuItem[] = [
    { key: 'dashboard', href: '/department-head?pg=dashboard', icon: 'dashboard', label: 'Dashboard', featureKey: HOD_MENU_FEATURE_KEYS.dashboard },
    { key: 'activities', href: '/department-head?pg=activities', icon: 'track_changes', label: 'Strategic Activities', featureKey: HOD_MENU_FEATURE_KEYS.activities },
    { key: 'departmental-activities', href: '/department-head?pg=departmental-activities', icon: 'apartment', label: 'Departmental Activities', featureKey: HOD_MENU_FEATURE_KEYS['departmental-activities'] },
    { key: 'tasks', href: '/department-head?pg=tasks', icon: 'checklist', label: 'Processes', featureKey: HOD_MENU_FEATURE_KEYS.tasks },
    { key: 'staff', href: '/department-head?pg=staff', icon: 'group', label: 'Staff & Warnings', featureKey: HOD_MENU_FEATURE_KEYS.staff },
    { key: 'evaluations', href: '/department-head?pg=evaluations', icon: 'fact_check', label: 'Submissions & reviews', featureKey: HOD_MENU_FEATURE_KEYS.evaluations },
    { key: 'reports', href: '/department-head?pg=reports', icon: 'analytics', label: 'Performance & Reports', featureKey: HOD_MENU_FEATURE_KEYS.reports },
    { key: 'notifications', href: '/department-head?pg=notifications', icon: 'notifications_active', label: 'Notifications' },
  ];

  const ambassadorMenuItems: MenuItem[] = [
    {
      key: 'tracking',
      href: '/ambassador?pg=tracking&tab=dashboard',
      icon: 'monitoring',
      label: 'Tracking',
      featureKey: AMBASSADOR_MENU_FEATURE_KEYS.tracking,
    },
    {
      key: 'reporting',
      href: '/ambassador?pg=reporting&tab=data-collection',
      icon: 'bar_chart',
      label: 'Reporting',
      featureKey: AMBASSADOR_MENU_FEATURE_KEYS.reporting,
    },
    {
      key: 'propose-changes',
      href: '/ambassador?pg=propose-changes',
      icon: 'edit_note',
      label: 'Propose Changes',
      featureKey: AMBASSADOR_MENU_FEATURE_KEYS['propose-changes'],
    },
    { key: 'notifications', href: '/ambassador?pg=notifications', icon: 'notifications_active', label: 'Notifications' },
  ];

  const staffMenuItems = [
    { key: 'dashboard', href: '/staff?pg=dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'tasks', href: '/staff?pg=tasks', icon: 'checklist', label: 'Tasks' },
    { key: 'notifications', href: '/staff?pg=notifications', icon: 'notifications_active', label: 'Notifications & Deadlines' },
    { key: 'submissions', href: '/staff?pg=submissions', icon: 'history', label: 'Submissions & Feedback' },
    { key: 'academic-teaching', href: '/staff?pg=academic-teaching', icon: 'school', label: 'Lecturer teaching data' },
  ];

  const isAmbassador = pathname.startsWith('/ambassador');
  const isDepartmentHead = pathname.startsWith('/department-head');
  const isStaff = pathname.startsWith('/staff');
  const isAdmin = pathname.startsWith('/admin');
  const showNotificationBadge = isAmbassador || isDepartmentHead || isStaff;
  const { unreadCount } = useUnreadNotificationCount(showNotificationBadge);
  const { flags: portalFlags } = usePortalFeatures();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isAcademicStaff, setIsAcademicStaff] = useState<boolean | null>(null);
  const [hasAcademicTeachingScope, setHasAcademicTeachingScope] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setIsSystemAdmin(false);
      return;
    }
    let cancelled = false;
    void fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { activeRole?: string } | null) => {
        if (cancelled) return;
        setIsSystemAdmin(normalizeRoleForCookie(data?.activeRole) === 'System Administrator');
      })
      .catch(() => {
        if (!cancelled) setIsSystemAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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

  const filterByPortalFeatures = (items: MenuItem[]) =>
    items.filter((item) => !item.featureKey || isFeatureEnabled(portalFlags, item.featureKey));

  const visibleDepartmentHeadMenuItems = useMemo(
    () => filterByPortalFeatures(departmentHeadMenuItems),
    [portalFlags]
  );

  const visibleAmbassadorMenuItems = useMemo(
    () => filterByPortalFeatures(ambassadorMenuItems),
    [portalFlags]
  );

  const visibleAdminMenuItems = useMemo(
    () => adminMenuItems.filter((item) => item.key !== 'settings' || isSystemAdmin),
    [isSystemAdmin]
  );

  const isActive = (key: string) => currentKey === key;

  const renderFlatMenu = (items: MenuItem[]) =>
    items.map((item) => {
      const isNotifications = item.key === 'notifications';
      const showBadge = isNotifications && unreadCount > 0;
      const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

      return (
        <Link
          href={item.href}
          key={item.key}
          className={`sidebar-link ${isActive(item.key) ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        >
          <span className="sidebar-icon-wrap">
            <span
              className={`material-symbols-outlined ms-icon${showBadge ? ' sidebar-bell-ring' : ''}`}
            >
              {item.icon}
            </span>
            {showBadge ? (
              <span className="sidebar-notif-badge" aria-label={`${unreadCount} unread notifications`}>
                {badgeLabel}
              </span>
            ) : null}
          </span>
          <span className="sidebar-link-label flex-grow-1">{item.label}</span>
        </Link>
      );
    });

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
            ? renderFlatMenu(visibleAmbassadorMenuItems)
            : isDepartmentHead
              ? renderFlatMenu(visibleDepartmentHeadMenuItems)
              : isStaff
                ? renderFlatMenu(visibleStaffMenuItems)
                : renderFlatMenu(visibleAdminMenuItems)}

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
