import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatRoleForDisplay, dashboardPathForRole, normalizeRoleForCookie } from '@/lib/role-routing';

interface TopbarProps {
  pageTitle: string;
  toggleSidebar: () => void;
}

export default function Topbar({ pageTitle, toggleSidebar }: TopbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user context
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setActiveRole(data.activeRole);
          setRoles(data.roles);
        }
      } catch (error) {
        console.error('Failed to fetch user', error);
      }
    };
    fetchUser();
  }, []);

  const handleRoleSwitch = async (newRole: string) => {
    setLoadingRole(newRole);
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const canonicalRole = normalizeRoleForCookie(data.activeRole || newRole);
        const redirectPath = dashboardPathForRole(canonicalRole) || '/staff';
        window.location.href = redirectPath;
      } else {
        alert('Failed to switch role');
        setLoadingRole(null);
      }
    } catch (error) {
      console.error('Role switch error', error);
      alert('Failed to switch role');
      setLoadingRole(null);
    }
  };

  return (
    <header className="topbar">
      <div className="d-flex align-items-center gap-3">
        <button
          className="d-lg-none btn btn-sm text-white p-1"
          style={{ background: 'rgba(255,255,255,.1)', borderRadius: '8px' }}
          onClick={toggleSidebar}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <nav className="breadcrumb-nav d-flex align-items-center text-white-50">
          <span>{activeRole ? formatRoleForDisplay(activeRole) : 'Portal'}</span>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#93c5fd', margin: '0 .3rem' }}>
            chevron_right
          </span>
          <span className="text-white fw-bold" id="breadcrumbLabel">{pageTitle}</span>
        </nav>
      </div>

      <div className="d-flex align-items-center gap-3">


        <button className="avatar-btn" data-bs-toggle="dropdown">
          <div className="text-end d-none d-sm-block">
            <div className="text-white fw-bold" style={{ fontSize: '.8rem', lineHeight: '1.1' }}>
              {user ? user.full_name : 'Loading...'}
            </div>
            <div className="text-white-50" style={{ fontSize: '.68rem' }}>
              {formatRoleForDisplay(activeRole) || '...'}
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--mubs-yellow)',
            border: '2px solid var(--mubs-yellow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-navy)', fontSize: '20px' }}>person</span>
          </div>
        </button>

        <ul className="dropdown-menu dropdown-menu-end shadow">
          <li><h6 className="dropdown-header text-muted small">Signed in as</h6></li>
          <li><span className="dropdown-item-text fw-bold text-dark">{user ? user.full_name : '...'}</span></li>

          {roles.length > 1 && (
            <>
              <li><hr className="dropdown-divider" /></li>
              <li><h6 className="dropdown-header text-muted small pb-1">Switch Role</h6></li>
              {roles.map(role => (
                normalizeRoleForCookie(role) !== activeRole ? (
                  <li key={role}>
                    <button
                      className="dropdown-item d-flex align-items-center justify-content-between"
                      onClick={() => handleRoleSwitch(role)}
                      disabled={loadingRole === role}
                    >
                      <span>View as {formatRoleForDisplay(role)}</span>
                      {loadingRole === role && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                    </button>
                  </li>
                ) : null
              ))}
            </>
          )}

          <li><hr className="dropdown-divider" /></li>
          <li>
            <a className="dropdown-item text-danger" href="#" onClick={async (e) => {
              e.preventDefault();
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/';
            }}>
              <span className="material-symbols-outlined me-1" style={{ fontSize: '18px' }}>logout</span>Logout
            </a>
          </li>
        </ul>

      </div>
    </header>
  );
}