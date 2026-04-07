interface StatCardProps {
  label: string;
  value: string | number;
  color: 'blue' | 'yellow' | 'green' | 'red';
  /** Unused — kept so existing call sites need no changes */
  icon?: string;
  badge?: string;
  badgeIcon?: string;
}

const BORDER: Record<StatCardProps['color'], string> = {
  blue: 'var(--mubs-blue)',
  yellow: 'var(--mubs-yellow)',
  green: '#10b981',
  red: 'var(--mubs-red)',
};

export default function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="stat-card" style={{ borderLeftColor: BORDER[color] }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
