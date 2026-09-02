'use client';

import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';

export type SearchableOption = { value: string; label: string; hint?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  onQueryChange?: (query: string) => void;
};

/** Searchable single-select, same pattern as IndicatorPickerField / department search. */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Type to search…',
  emptyLabel = 'None',
  allowEmpty = true,
  disabled = false,
  onQueryChange,
}: Props) {
  const selected = options.find((o) => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = (open ? query : '').trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q))
      : options;
    return list.slice(0, 80);
  }, [options, open, query]);

  const displayValue = open ? query : (selected?.label ?? '');

  const pick = (next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="position-relative">
      <span
        className="material-symbols-outlined position-absolute text-muted"
        style={{ left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}
      >
        search
      </span>
      <Form.Control
        size="sm"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        autoComplete="off"
        style={{ paddingLeft: '2rem' }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
          onQueryChange?.('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onQueryChange?.(e.target.value);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
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
              onClick={() => pick('')}
            >
              {emptyLabel}
            </button>
          ) : null}
          {matches.length === 0 ? (
            <div className="px-2 py-2 text-muted small">No matches</div>
          ) : (
            matches.map((o) => (
              <button
                key={o.value}
                type="button"
                className="btn btn-white w-100 text-start px-2 py-1 border-bottom small d-flex justify-content-between align-items-center"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
              >
                <span>
                  <span className="small d-block">{o.label}</span>
                  {o.hint ? <span className="text-muted" style={{ fontSize: '0.65rem' }}>{o.hint}</span> : null}
                </span>
                {o.value === value ? (
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
