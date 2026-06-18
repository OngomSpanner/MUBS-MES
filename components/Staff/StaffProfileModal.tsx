'use client';

import {
  buildStaffProfileRows,
  StaffProfileData,
  type StaffProfileViewMode,
} from '@/lib/staff-biodata';
import { getInitials } from '@/lib/display-utils';
import MubsModal, {
  MUBS_MODAL_BTN_STYLE,
  MUBS_MODAL_PRIMARY_BTN_STYLE,
  MubsModalHero,
  mubsModalBtnClass,
} from '@/components/Modals/MubsModal';
import MubsDetailRows from '@/components/Modals/MubsDetailRows';

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

  const footer = (
    <>
      {mode === 'admin' && onEditUser ? (
        <button
          type="button"
          className={mubsModalBtnClass('outline-secondary')}
          style={MUBS_MODAL_BTN_STYLE}
          onClick={onEditUser}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            edit
          </span>
          Edit in Users
        </button>
      ) : null}
      {onEvaluations ? (
        <button
          type="button"
          className={mubsModalBtnClass('outline-primary')}
          style={MUBS_MODAL_BTN_STYLE}
          onClick={onEvaluations}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            rate_review
          </span>
          Evaluations
        </button>
      ) : null}
      {onViewTasks ? (
        <button
          type="button"
          className={mubsModalBtnClass('primary')}
          style={MUBS_MODAL_PRIMARY_BTN_STYLE}
          onClick={onViewTasks}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            checklist
          </span>
          View assigned processes
        </button>
      ) : null}
      <button type="button" className={mubsModalBtnClass('light')} style={MUBS_MODAL_BTN_STYLE} onClick={onClose}>
        Close
      </button>
    </>
  );

  return (
    <MubsModal show title="Staff profile" icon="badge" onClose={onClose} footer={footer}>
      <MubsModalHero
        initials={getInitials(staff.full_name)}
        title={staff.full_name}
        subtitle={staff.email}
      />
      <MubsDetailRows sectionTitle="Staff information" rows={rows} />
    </MubsModal>
  );
}
