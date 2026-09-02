'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q))
      : options;
    return list.slice(0, 80);
  }, [options, query]);

  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <div className="position-relative" ref={wrapRef}>
      <Form.Control
        size="sm"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setQuery('');
          onQueryChange?.('');
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          onQueryChange?.(next);
          if (value && next !== selected?.label) onChange('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open ? (
        <div
          className="border rounded-2 bg-white shadow-sm position-absolute w-100 mt-1"
          style={{ zIndex: 1080, maxHeight: 260, overflowY: 'auto' }}
        >
          {allowEmpty ? (
            <button
              type="button"
              className="dropdown-item small py-2"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {emptyLabel}
            </button>
          ) : null}
          {matches.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`dropdown-item small py-2 ${o.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <div>{o.label}</div>
              {o.hint ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{o.hint}</div> : null}
            </button>
          ))}
          {matches.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
