'use client';

type Props = {
  label: string;
  count?: number;
  active?: boolean;
  title?: string;
  onClick: () => void;
};

export default function AmbassadorGroupBadgeChip({
  label,
  count,
  active = false,
  title,
  onClick,
}: Props) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`badge border ${active ? 'text-white' : 'bg-light text-primary'}`}
      style={{
        fontSize: '0.62rem',
        fontWeight: 600,
        cursor: 'pointer',
        padding: '2px 6px',
        lineHeight: 1.35,
        ...(active
          ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }
          : { borderColor: 'rgba(13, 110, 253, 0.35)' }),
      }}
      title={title}
    >
      {label}
      {count != null ? ` (${count})` : ''}
    </span>
  );
}
