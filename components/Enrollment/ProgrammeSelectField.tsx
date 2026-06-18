'use client';

import { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import axios from 'axios';
import type { MubsProgrammeLevel } from '@/lib/mubs-programmes';

type ProgrammeOption = {
  id: number;
  name: string;
  level: MubsProgrammeLevel;
};

type ProgrammeSelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'lg';
  placeholder?: string;
};

export default function ProgrammeSelectField({
  value,
  onChange,
  disabled = false,
  required = false,
  size = 'sm',
  placeholder = 'Select programme…',
}: ProgrammeSelectFieldProps) {
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void axios
      .get('/api/programmes')
      .then((r) => {
        if (!cancelled) setProgrammes(r.data.programmes ?? []);
      })
      .catch(() => {
        if (!cancelled) setProgrammes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ProgrammeOption[]>();
    for (const p of programmes) {
      const list = map.get(p.level) ?? [];
      list.push(p);
      map.set(p.level, list);
    }
    return [...map.entries()];
  }, [programmes]);

  return (
    <Form.Select
      size={size}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      required={required}
    >
      <option value="">{loading ? 'Loading programmes…' : placeholder}</option>
      {grouped.map(([level, items]) => (
        <optgroup key={level} label={level}>
          {items.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
      {value && !programmes.some((p) => p.name === value) && (
        <option value={value}>{value} (saved)</option>
      )}
    </Form.Select>
  );
}
