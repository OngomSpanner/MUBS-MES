'use client';

type RecordActionsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export default function RecordActions({ onView, onEdit, onDelete, disabled }: RecordActionsProps) {
  return (
    <div className="d-flex gap-1 justify-content-end flex-wrap">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="View details"
        disabled={disabled}
        onClick={onView}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        title="Edit"
        disabled={disabled}
        onClick={onEdit}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        title="Delete"
        disabled={disabled}
        onClick={onDelete}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
      </button>
    </div>
  );
}
