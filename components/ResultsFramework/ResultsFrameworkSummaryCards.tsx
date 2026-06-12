'use client';

import type { ResultsFrameworkSummary } from '@/lib/results-framework-query';

export default function ResultsFrameworkSummaryCards({
  summary,
  financialYear,
}: {
  summary: ResultsFrameworkSummary;
  financialYear?: string;
}) {
  const cards = [
    { label: 'Indicators', value: summary.total, color: '#005696' },
    { label: 'Assessed', value: summary.assessed, color: '#15803d' },
    { label: 'Underperformance', value: summary.underperformance, color: '#b91c1c' },
    { label: 'Achievement', value: summary.achievement, color: '#15803d' },
    { label: 'Overachievement', value: summary.overachievement, color: '#1d4ed8' },
    { label: 'Narratives complete', value: summary.narrativesComplete, color: '#7c3aed' },
    { label: 'Narratives missing', value: summary.narrativesMissing, color: '#b45309' },
  ];

  return (
    <div className="mb-3">
      {financialYear ? (
        <p className="text-muted small mb-2">
          Financial year <strong>{financialYear}</strong> — target vs actual against Results Framework indicators.
        </p>
      ) : null}
      {summary.narrativesMissing > 0 ? (
        <div className="alert alert-warning py-2 small mb-2">
          <strong>{summary.narrativesMissing}</strong> assessed indicator
          {summary.narrativesMissing === 1 ? '' : 's'} still need an ambassador outcome narrative.
        </div>
      ) : summary.narrativesRequired > 0 ? (
        <div className="alert alert-success py-2 small mb-2">
          All assessed indicators have ambassador narratives recorded.
        </div>
      ) : null}
      <div className="row g-2">
        {cards.map((c) => (
          <div key={c.label} className="col-6 col-md-4 col-xl">
            <div
              className="p-2 rounded-3 border bg-white h-100"
              style={{ borderLeft: `3px solid ${c.color}` }}
            >
              <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.62rem' }}>
                {c.label}
              </div>
              <div className="fw-black text-dark" style={{ fontSize: '1.15rem' }}>
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
