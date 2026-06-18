'use client';

import type { ReactNode } from 'react';

export const MUBS_MODAL_BACKDROP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  zIndex: 1050,
  backdropFilter: 'blur(4px)',
};

type MubsModalProps = {
  show: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function MubsModal({ show, onClose, title, icon, children, footer }: MubsModalProps) {
  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={MUBS_MODAL_BACKDROP_STYLE}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
            <h5
              className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0"
              style={{ fontSize: '1.1rem' }}
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>
                {icon}
              </span>
              {title}
            </h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body p-4 pt-3">{children}</div>
          {footer != null ? (
            <div className="modal-footer border-top bg-light px-4 py-3 d-flex flex-wrap justify-content-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MubsModalAvatar({ initials }: { initials: string }) {
  return (
    <div
      className="staff-avatar flex-shrink-0"
      style={{
        background: 'var(--mubs-blue)',
        width: '64px',
        height: '64px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '1.5rem',
      }}
    >
      {initials}
    </div>
  );
}

export function MubsModalHero({
  initials,
  title,
  subtitle,
  badge,
}: {
  initials: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="d-flex align-items-start gap-4 mb-4 flex-wrap">
      <MubsModalAvatar initials={initials} />
      <div className="flex-grow-1" style={{ minWidth: '200px' }}>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
          <h6 className="fw-black text-dark mb-1" style={{ fontSize: '1.15rem' }}>
            {title}
          </h6>
          {badge}
        </div>
        {subtitle ? (
          <div className="text-muted" style={{ fontSize: '0.88rem' }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function mubsModalBtnClass(
  variant: 'light' | 'outline-secondary' | 'outline-primary' | 'outline-danger' | 'outline-warning' | 'primary' = 'light'
) {
  const variantClass = {
    light: 'btn-light',
    'outline-secondary': 'btn-outline-secondary',
    'outline-primary': 'btn-outline-primary',
    'outline-danger': 'btn-outline-danger',
    'outline-warning': 'btn-outline-warning',
    primary: 'btn-primary',
  }[variant];
  return `btn ${variantClass} fw-bold px-3 py-2 d-inline-flex align-items-center gap-2`;
}

export const MUBS_MODAL_BTN_STYLE: React.CSSProperties = { borderRadius: '8px', fontSize: '0.85rem' };

export const MUBS_MODAL_PRIMARY_BTN_STYLE: React.CSSProperties = {
  background: 'var(--mubs-blue)',
  borderColor: 'var(--mubs-blue)',
  borderRadius: '8px',
  fontSize: '0.85rem',
};
