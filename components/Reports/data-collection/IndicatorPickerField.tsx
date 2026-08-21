'use client';

import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { strategicPillarNumber, strategicPillarShortLabel } from '@/lib/strategic-plan';
import type { StrategyIndicatorResult } from '@/lib/questionnaire/compute-strategy-results';

export function indicatorMatchesQuery(ind: StrategyIndicatorResult, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (ind.indicatorText.toLowerCase().includes(q)) return true;
  if (ind.outcomeLabel.toLowerCase().includes(q)) return true;
  if ((ind.strategicPillar ?? '').toLowerCase().includes(q)) return true;
  if ((ind.pillarCode ?? '').toLowerCase().includes(q)) return true;
  return (ind.offices ?? []).some((o) => o.name.toLowerCase().includes(q));
}

export function sortStrategyIndicators(a: StrategyIndicatorResult, b: StrategyIndicatorResult): number {
  const pa = strategicPillarNumber(a.strategicPillar) ?? 99;
  const pb = strategicPillarNumber(b.strategicPillar) ?? 99;
  if (pa !== pb) return pa - pb;
  const oa = `${a.outcomeType} ${a.outcomeLabel}`.toLowerCase();
  const ob = `${b.outcomeType} ${b.outcomeLabel}`.toLowerCase();
  if (oa !== ob) return oa.localeCompare(ob);
  return a.indicatorText.localeCompare(b.indicatorText);
}

type Props = {
  indicators: StrategyIndicatorResult[];
  value: number;
  onChange: (indicatorId: number) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export default function IndicatorPickerField({
  indicators,
  value,
  onChange,
  placeholder = 'Type to search indicators…',
  allowEmpty = false,
  emptyLabel = 'None',
}: Props) {
  const selected = indicators.find((i) => i.indicatorId === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const term = open ? query : '';
    const matches = [...indicators]
      .filter((ind) => indicatorMatchesQuery(ind, term))
      .sort(sortStrategyIndicators)
      .slice(0, 60);

    const groups: Array<{ pillar: string; items: StrategyIndicatorResult[] }> = [];
    for (const ind of matches) {
      const pillar = ind.pillarCode
        ? `${ind.pillarCode} · ${strategicPillarShortLabel(ind.strategicPillar)}`
        : strategicPillarShortLabel(ind.strategicPillar);
      const last = groups[groups.length - 1];
      if (last && last.pillar === pillar) last.items.push(ind);
      else groups.push({ pillar, items: [ind] });
    }
    return groups;
  }, [indicators, open, query]);

  const displayValue = open ? query : (selected?.indicatorText ?? '');

  return (
    <div className="position-relative">
      <Form.Control
        size="sm"
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value && e.target.value !== selected?.indicatorText) onChange(0);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open ? (
        <div
          className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 overflow-auto"
          style={{ zIndex: 1080, maxHeight: 280 }}
        >
          {allowEmpty ? (
            <button
              type="button"
              className="btn btn-white w-100 text-start px-2 py-1 border-bottom small"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(0);
                setQuery('');
                setOpen(false);
              }}
            >
              {emptyLabel}
            </button>
          ) : null}
          {grouped.length === 0 ? (
            <div className="px-2 py-2 text-muted small">No matching indicators</div>
          ) : (
            grouped.map((group) => (
              <div key={group.pillar}>
                <div className="px-2 py-1 small fw-semibold text-muted bg-light">{group.pillar}</div>
                {group.items.map((ind) => (
                  <button
                    key={ind.indicatorId}
                    type="button"
                    className="btn btn-white w-100 text-start px-2 py-1 border-bottom"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(ind.indicatorId);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <div className="small fw-semibold">{ind.indicatorText}</div>
                    <div className="text-muted" style={{ fontSize: '0.65rem' }}>
                      {ind.outcomeType}: {ind.outcomeLabel}
                      {(ind.offices?.length ?? 0) === 1 ? ` · ${ind.offices[0].name}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
