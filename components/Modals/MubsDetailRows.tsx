'use client';

export type MubsDetailRow = { label: string; value: string };

type MubsDetailRowsProps = {
  sectionTitle: string;
  rows: MubsDetailRow[];
};

export default function MubsDetailRows({ sectionTitle, rows }: MubsDetailRowsProps) {
  const visible = rows.filter((row) => {
    const v = String(row.value ?? '').trim();
    return v !== '' && v !== '—';
  });

  if (visible.length === 0) return null;

  return (
    <>
      <div
        className="text-muted fw-bold mb-2"
        style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        {sectionTitle}
      </div>
      <div className="rounded-3 border bg-light overflow-hidden mb-2">
        {visible.map((row, idx) => (
          <div
            key={row.label}
            className={`d-flex justify-content-between align-items-start gap-3 px-3 py-2 bg-white ${idx < visible.length - 1 ? 'border-bottom' : ''}`}
            style={{ fontSize: '0.82rem' }}
          >
            <span className="text-muted fw-semibold flex-shrink-0">{row.label}</span>
            <span className="text-dark text-end" style={{ wordBreak: 'break-word' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
