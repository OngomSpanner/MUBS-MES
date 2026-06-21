'use client';

type Props = {
  label: string;
  count?: number;
  active?: boolean;
  variant?: 'default' | 'clear';
  title?: string;
  onClick: () => void;
};

export default function AmbassadorGroupBadgeChip({
  label,
  count,
  active = false,
  variant = 'default',
  title,
  onClick,
}: Props) {
  const isClear = variant === 'clear';
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
      className={`badge border ${active ? 'text-white' : isClear ? 'bg-white text-secondary' : 'bg-light text-primary'}`}
      style={{
        fontSize: '0.62rem',
        fontWeight: 600,
        cursor: 'pointer',
        padding: '2px 6px',
        lineHeight: 1.35,
        ...(active
          ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }
          : isClear
            ? { borderColor: 'rgba(108, 117, 125, 0.5)' }
            : { borderColor: 'rgba(13, 110, 253, 0.35)' }),
      }}
      title={title}
    >
      {label}
      {count != null ? ` (${count})` : ''}
    </span>
  );
}
