'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import SearchableSelect, { type SearchableOption } from '@/components/ActionTracker/SearchableSelect';

type Person = { id: number; full_name: string; email?: string | null; department_name?: string | null };

type Extra = { value: string; label: string; hint?: string };

export default function PeopleSearchSelect({
  value,
  onChange,
  departmentId,
  extraOptions = [],
  placeholder = 'Type to search people…',
}: {
  value: string;
  onChange: (value: string) => void;
  departmentId?: string;
  extraOptions?: Extra[];
  placeholder?: string;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void axios
        .get('/api/action-tracker/people', {
          params: {
            q: query || undefined,
            department_id: departmentId || undefined,
          },
        })
        .then((r) => setPeople(r.data.people || []))
        .catch(() => setPeople([]));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, departmentId]);

  const options = useMemo<SearchableOption[]>(() => {
    const fromPeople = people.map((p) => ({
      value: String(p.id),
      label: p.full_name,
      hint: [p.department_name, p.email].filter(Boolean).join(' · ') || undefined,
    }));
    const seen = new Set(fromPeople.map((o) => o.value));
    const extras = extraOptions.filter((o) => o.value && !seen.has(o.value));
    return [...extras, ...fromPeople];
  }, [people, extraOptions]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      emptyLabel="Select person"
      onQueryChange={setQuery}
    />
  );
}
