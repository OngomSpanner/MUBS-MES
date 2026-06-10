'use client';

import {
  buildStaffProfileRows,
  StaffProfileData,
  type StaffProfileViewMode,
} from '@/lib/staff-biodata';

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.map((n) => n[0]).join('').toUpperCase().slice(0, 3);
}

export interface StaffProfileModalProps {
  staff: StaffProfileData | null;
  onClose: () => void;
  mode: StaffProfileViewMode;
  onEvaluations?: () => void;
  onViewTasks?: () => void;
  onEditUser?: () => void;
}

export default function StaffProfileModal({
  staff,
  onClose,
  mode,
  onEvaluations,
  onViewTasks,
  onEditUser,
}: StaffProfileModalProps) {
  if (!staff) return null;

  const rows = buildStaffProfileRows(staff, mode);

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
            <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1.1rem' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>badge</span>
              Staff profile
            </h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body p-4 pt-3">
            <div className="d-flex align-items-start gap-4 mb-4 flex-wrap">
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
                {getInitials(staff.full_name)}
              </div>
              <div className="flex-grow-1" style={{ minWidth: '200px' }}>
                <h6 className="fw-black text-dark mb-1" style={{ fontSize: '1.15rem' }}>
                  {staff.full_name}
                </h6>
                <div className="text-muted" style={{ fontSize: '0.88rem' }}>
                  {staff.email}
                </div>
              </div>
            </div>

            <div
              className="text-muted fw-bold mb-2"
              style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Staff information
            </div>
            <div className="rounded-3 border bg-light overflow-hidden mb-2">
              {rows.map((row, idx) => (
                <div
                  key={row.label}
                  className={`d-flex justify-content-between align-items-start gap-3 px-3 py-2 bg-white ${idx < rows.length - 1 ? 'border-bottom' : ''}`}
                  style={{ fontSize: '0.82rem' }}
                >
                  <span className="text-muted fw-semibold flex-shrink-0">{row.label}</span>
                  <span className="text-dark text-end" style={{ wordBreak: 'break-word' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer border-top bg-light px-4 py-3 d-flex flex-wrap justify-content-end gap-2">
            {mode === 'admin' && onEditUser ? (
              <button
                type="button"
                className="btn btn-outline-secondary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                onClick={onEditUser}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                Edit in Users
              </button>
            ) : null}
            {onEvaluations ? (
              <button
                type="button"
                className="btn btn-outline-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                onClick={onEvaluations}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rate_review</span>
                Evaluations
              </button>
            ) : null}
            {onViewTasks ? (
              <button
                type="button"
                className="btn btn-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
                style={{
                  background: 'var(--mubs-blue)',
                  borderColor: 'var(--mubs-blue)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                }}
                onClick={onViewTasks}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>checklist</span>
                View assigned processes
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-light fw-bold px-3 py-2"
              style={{ borderRadius: '8px', fontSize: '0.85rem' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
