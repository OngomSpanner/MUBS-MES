'use client';

export type AmbassadorTableView = 'entries' | 'summary';

type AmbassadorReportViewToggleProps = {
  view: AmbassadorTableView;
  onChange: (view: AmbassadorTableView) => void;
  entriesLabel?: string;
  summaryLabel?: string;
};

export default function AmbassadorReportViewToggle({
  view,
  onChange,
  entriesLabel = 'Data entries',
  summaryLabel = 'Summary',
}: AmbassadorReportViewToggleProps) {
  const btnClass = (active: boolean) =>
    `btn btn-sm fw-bold px-3 ${active ? 'btn-primary' : 'btn-outline-secondary'}`;

  return (
    <div className="btn-group" role="group" aria-label="Switch table view">
      <button
        type="button"
        className={btnClass(view === 'entries')}
        style={view === 'entries' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        onClick={() => onChange('entries')}
      >
        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '16px' }}>
          list
        </span>
        {entriesLabel}
      </button>
      <button
        type="button"
        className={btnClass(view === 'summary')}
        style={view === 'summary' ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
        onClick={() => onChange('summary')}
      >
        <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '16px' }}>
          table_chart
        </span>
        {summaryLabel}
      </button>
    </div>
  );
}
