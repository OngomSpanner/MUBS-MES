'use client';

export type PerformanceMetricRow = {
  id: number;
  metric_text: string;
  unit_of_measure: string;
};

type Props = {
  metrics: PerformanceMetricRow[];
  financialYears: string[];
  getValue: (metricId: number, fy: string) => string | null;
  departmentName?: string;
};

export default function PerformanceMetricsTable({
  metrics,
  financialYears,
  getValue,
  departmentName,
}: Props) {
  if (metrics.length === 0) {
    return <p className="text-muted small mb-0">No metrics defined.</p>;
  }

  return (
    <div>
      <div className="text-muted fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
        Performance Metrics
        {departmentName ? (
          <span className="text-normal fw-normal ms-2 text-secondary">— {departmentName}</span>
        ) : null}
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.78rem' }}>
          <thead className="table-dark">
            <tr>
              <th style={{ width: '30px' }}>#</th>
              <th>Metric</th>
              {financialYears.map((fy) => (
                <th key={fy} className="text-center" style={{ width: '90px' }}>
                  {fy}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, mi) => (
              <tr key={m.id}>
                <td className="text-center fw-bold" style={{ color: 'var(--mubs-gold, #C8922A)' }}>
                  {mi + 1}
                </td>
                <td>{m.metric_text}</td>
                {financialYears.map((fy) => {
                  const val = getValue(m.id, fy);
                  return (
                    <td
                      key={fy}
                      className={`text-center ${val ? 'fw-semibold' : 'text-muted'}`}
                      style={{ fontSize: '0.72rem', fontStyle: val ? 'normal' : 'italic' }}
                    >
                      {val ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
